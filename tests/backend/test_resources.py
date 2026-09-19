import pytest
from conftest import create

def test_reference_integrity_bidirectional_links_and_derived_risk(client):
    framework = create(client,'frameworks')
    control = create(client,'controls',framework_ids=[framework['id']])
    evidence = create(client,'evidence',control_ids=[control['id']])
    policy = create(client,'policies',control_ids=[control['id']])
    read = lambda r,i: client.get(f'/api/{r}/{i}').json()
    assert read('controls',control['id'])['evidence_ids'] == [evidence['id']]
    assert read('controls',control['id'])['policy_ids'] == [policy['id']]
    bad = client.post('/api/controls',json={'title':'bad link','framework_ids':['absent']})
    assert bad.status_code == 422
    assert client.post('/api/tasks',json={'title':'bad relation','related_type':'risks'}).status_code == 422
    task = create(client,'tasks',related_type='controls',related_id=control['id'])
    risk = create(client,'risks',likelihood=5,impact=4,residual_likelihood=3,residual_impact=2,control_ids=[control['id']])
    assert (risk['inherent_score'],risk['residual_score']) == (20,6)
    for invalid in [{'likelihood':6},{'impact':True},{'inherent_score':20},{'vendor_id':'no'}]:
        assert client.patch('/api/risks/'+risk['id'],json=invalid).status_code == 422
    assert client.delete('/api/controls/'+control['id']).status_code == 200
    assert read('risks',risk['id'])['control_ids'] == []
    assert read('evidence',evidence['id'])['control_ids'] == []
    assert read('tasks',task['id'])['related_id'] == ''
    audit = create(client,'audits')
    create(client,'audit_requests',audit_id=audit['id'])
    assert client.delete('/api/audits/'+audit['id']).status_code == 409


RESOURCES = 'frameworks controls policies vendors risks evidence audits audit_requests tasks people assets access_reviews questionnaires exceptions'.split()


@pytest.mark.parametrize('resource', RESOURCES)
def test_schema_driven_crud_persists_and_logs(client, resource):
    schema = client.get('/api/schema')
    assert schema.status_code == 200
    meta = schema.json()['resources'][resource]
    assert {'label','singular','statuses','fields'} <= meta.keys()
    args = {'audit_id': create(client,'audits')['id']} if resource == 'audit_requests' else {}
    item = create(client,resource, title="CRUD O'Reilly; DROP TABLE records", **args)
    assert item['status'] == meta['statuses'][0]
    assert item['owner'] == '' and item['tags'] == [] and item['due_date'] is None
    assert client.get(f"/api/{resource}/{item['id']}").json() == item
    listed = client.get(f'/api/{resource}', params={'q': 'DROP TABLE'}).json()
    assert listed['total'] == 1 and listed['items'][0]['id'] == item['id']
    updated = client.patch(f"/api/{resource}/{item['id']}",json={'owner':'Owner','tags':['important']})
    assert updated.status_code == 200 and updated.json()['owner'] == 'Owner'
    for invalid in [{'title':''}, {'status':'nonsense'}, {'due_date':'2026-02-30'}, {'tags':'tag'}, {'id':'fake'}, {'unknown':1}]:
        result = client.patch(f"/api/{resource}/{item['id']}",json=invalid)
        assert result.status_code == 422 and isinstance(result.json()['detail'],str)
    assert client.delete(f"/api/{resource}/{item['id']}").json() == {'deleted':True}
    assert client.get(f"/api/{resource}/{item['id']}").status_code == 404
    assert client.delete(f"/api/{resource}/{item['id']}").status_code == 404
    assert any(a['record_id']==item['id'] and a['action']=='delete' for a in client.get('/api/activity').json()['items'])
