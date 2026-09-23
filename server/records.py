"""Resource operations shared by CRUD and transactional imports."""
import json
from uuid import uuid4
from fastapi import HTTPException
from .schema import require_resource, validate
from .storage import Store, now
from .relations import validate_links, sync_links, clean_links


def get_record(db, resource, record_id):
    require_resource(resource)
    item = Store.get(db, resource, record_id)
    if item is None:
        raise HTTPException(404, 'Record not found')
    return item


def save(db, resource, item):
    db.execute('INSERT INTO records(resource,id,body) VALUES (?,?,?) ON CONFLICT(resource,id) DO UPDATE SET body=excluded.body',
               (resource, item['id'], json.dumps(item)))


def log(db, action, resource, item, details=None):
    entry = dict(id=str(uuid4()),action=action,resource=resource,record_id=item.get('id',''),
                 title=item.get('title',''),created_at=now(),details=details or {})
    db.execute('INSERT INTO activity(body) VALUES (?)', (json.dumps(entry),))


def create_record(db, resource, payload):
    item = validate(resource, payload)
    validate_links(db, resource, item)
    item.update(id=str(uuid4()), created_at=now(), updated_at=now())
    save(db, resource, item)
    sync_links(db, resource, item)
    log(db, 'create', resource, item)
    return item


def update_record(db, resource, record_id, payload):
    previous = get_record(db, resource, record_id)
    item = validate(resource, payload, previous)
    validate_links(db, resource, item)

    if resource == 'policies' and 'content' in payload and previous.get('content') != item.get('content'):
        prev_version = previous.get('version', 1)
        db.execute(
            "INSERT INTO policy_versions (id, policy_id, version, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid4()), record_id, prev_version, previous.get('content', ''), now())
        )
        item['version'] = prev_version + 1
        if previous.get('status') == 'published':
            item['status'] = 'draft'
            item['approved_at'] = None
            item['approver'] = ''

    if resource == 'controls':
        defn_fields = ['title', 'description', 'points_of_focus', 'test_procedure', 'evidence_requirement', 'type', 'nature', 'frequency', 'owner', 'criterion_mapping']
        if any(previous.get(k) != item.get(k) for k in defn_fields if k in payload):
            prev_version = previous.get('version', 1)
            db.execute(
                "INSERT INTO control_versions (id, control_id, version, body, created_at) VALUES (?, ?, ?, ?, ?)",
                (str(uuid4()), record_id, prev_version, json.dumps(previous), now())
            )
            item['version'] = prev_version + 1

    if resource == 'evidence':
        rows = db.execute("SELECT body FROM records WHERE resource='evidence'").fetchall()
        for r in rows:
            b = json.loads(r[0])
            if b.get('supersedes_id') == record_id:
                raise HTTPException(409, "Historical evidence versions are immutable and cannot be modified")

    item['updated_at'] = now()
    save(db, resource, item)
    sync_links(db, resource, item, previous)
    log(db, 'update', resource, item, {'fields':list(payload)})
    return item


def delete_record(db, resource, record_id):
    item = get_record(db, resource, record_id)
    if resource == 'evidence':
        if item.get('legal_hold'):
            raise HTTPException(409, "Cannot delete evidence under active legal hold")
        rows = db.execute("SELECT body FROM records WHERE resource='evidence'").fetchall()
        for r in rows:
            b = json.loads(r[0])
            if b.get('supersedes_id') == record_id:
                raise HTTPException(409, "Cannot delete superseded historical evidence version; only the head version may be deleted")
    clean_links(db, resource, record_id)
    if resource == 'policies':
        db.execute('DELETE FROM policy_versions WHERE policy_id=?', (record_id,))
    elif resource == 'controls':
        db.execute('DELETE FROM control_versions WHERE control_id=?', (record_id,))
    db.execute('DELETE FROM records WHERE resource=? AND id=?', (resource, record_id))
    log(db, 'delete', resource, item)
    return item


def activity(db, limit=200):
    rows = db.execute('SELECT body FROM activity ORDER BY seq DESC LIMIT ?', (limit,)).fetchall()
    total = db.execute('SELECT count(*) FROM activity').fetchone()[0]
    return dict(items=[json.loads(r[0]) for r in rows], total=total)
