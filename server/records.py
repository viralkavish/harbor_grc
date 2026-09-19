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

    item['updated_at'] = now()
    save(db, resource, item)
    sync_links(db, resource, item, previous)
    log(db, 'update', resource, item, {'fields':list(payload)})
    return item


def delete_record(db, resource, record_id):
    item = get_record(db, resource, record_id)
    clean_links(db, resource, record_id)
    if resource == 'policies':
        db.execute('DELETE FROM policy_versions WHERE policy_id=?', (record_id,))
    db.execute('DELETE FROM records WHERE resource=? AND id=?', (resource, record_id))
    log(db, 'delete', resource, item)
    return item


def activity(db, limit=200):
    rows = db.execute('SELECT body FROM activity ORDER BY seq DESC LIMIT ?', (limit,)).fetchall()
    total = db.execute('SELECT count(*) FROM activity').fetchone()[0]
    return dict(items=[json.loads(r[0]) for r in rows], total=total)
