"""Reference integrity and explicit two-way control/policy/evidence links."""
import json
from fastapi import HTTPException
from .schema import RESOURCES, fail
from .storage import Store, now


def validate_links(db, resource, item):
    for f in RESOURCES[resource]['fields']:
        if 'ref' in f:
            if f['key'] not in item:
                continue
            values = item[f['key']] if f['type']=='multiselect' else [item[f['key']]]
            for value in values:
                if value is not None and not Store.get(db, f['ref'],value):
                    fail(f['key'], f"unknown {f['ref']} ID: {value}")
    if resource=='tasks':
        kind, record_id = item['related_type'], item['related_id']
        if bool(kind) != bool(record_id) or (kind and (kind not in RESOURCES or not Store.get(db,kind,record_id))):
            fail('related_type/related_id','must be empty together or reference an existing record')
    if resource=='risks':
        l = item.get('likelihood')
        imp = item.get('impact')
        rl = item.get('residual_likelihood')
        ri = item.get('residual_impact')
        item['inherent_score'] = (l * imp) if (isinstance(l, int) and isinstance(imp, int)) else None
        item['residual_score'] = (rl * ri) if (isinstance(rl, int) and isinstance(ri, int)) else None


def write_linked(db, resource, item):
    item['updated_at'] = now()
    db.execute('UPDATE records SET body=? WHERE resource=? AND id=?', (json.dumps(item),resource,item['id']))


def sync_links(db, resource, item, previous=None):
    previous = previous or {}
    pairs = {'controls':[('evidence_ids','evidence','control_ids'),('policy_ids','policies','control_ids')],
             'evidence':[('control_ids','controls','evidence_ids')], 'policies':[('control_ids','controls','policy_ids')]}
    for local,other,remote in pairs.get(resource,[]):
        before, after = set(previous.get(local,[])), set(item[local])
        for record_id in before ^ after:
            linked = Store.get(db,other,record_id)
            if linked:
                ids = [i for i in linked[remote] if i!=item['id']]
                if record_id in after:
                    ids.append(item['id'])
                linked[remote] = ids
                write_linked(db,other,linked)


def clean_links(db, resource, record_id):
    # Required dependents block deletion; optional references are cleared atomically.
    for kind,meta in RESOURCES.items():
        linked_fields = [f for f in meta['fields'] if f.get('ref')==resource]
        for row in Store.records(db,kind):
            changed = False
            for f in linked_fields:
                key = f['key']
                if f['type']=='multiselect' and record_id in row[key]:
                    row[key].remove(record_id)
                    changed = True
                elif row[key]==record_id:
                    if f.get('required'):
                        raise HTTPException(409, f'Delete dependent {kind} records first')
                    row[key] = None
                    changed = True
            if kind=='tasks' and row['related_type']==resource and row['related_id']==record_id:
                row['related_type'] = row['related_id'] = ''
                changed = True
            if kind=='questionnaires' and resource=='policies':
                for question in row['questions']:
                    if record_id in question.get('source_ids',[]):
                        question['source_ids'].remove(record_id)
                        changed = True
            if changed:
                write_linked(db,kind,row)
    if resource=='controls':
        try:
            for rk in db.execute("SELECT id, mitigating_control_refs FROM risks").fetchall():
                try:
                    c_refs = json.loads(rk[1]) if rk[1] else []
                except Exception:
                    c_refs = []
                if record_id in c_refs:
                    c_refs = [c for c in c_refs if c != record_id]
                    db.execute("UPDATE risks SET mitigating_control_refs=? WHERE id=?", (json.dumps(c_refs), rk[0]))
        except Exception:
            pass
    if resource in {'policies','evidence'}:
        workspace = Store.workspace(db)
        key = 'trust_policy_ids' if resource=='policies' else 'trust_evidence_ids'
        workspace[key] = [i for i in workspace[key] if i!=record_id]
        db.execute('UPDATE settings SET value=? WHERE key=?', (json.dumps(workspace),'workspace'))
