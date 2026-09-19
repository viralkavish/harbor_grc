"""Single authoritative schema for forms, defaults, validation and CSV columns."""
from copy import deepcopy
from datetime import date
import re
from urllib.parse import urlsplit
from fastapi import HTTPException


def field(key, type='text', default='', **extras):
    return dict(key=key, label=key.replace('_', ' ').capitalize(), type=type, default=default, **extras)


def choice(key, values, default=None):
    options = values.split(',')
    return field(key, 'select', default or options[0], options=options)


def ref(key, resource, many=False, required=False):
    return field(key, 'multiselect' if many else 'select', [] if many else None, ref=resource, required=required)


def dates(*keys):
    return [field(k, 'date', None) for k in keys]


COMMON = [field('id', readonly=True), field('title', required=True, max_length=240),
          field('description','textarea'), field('owner'), *dates('due_date'),
          field('tags','multiselect',[]), field('created_at',readonly=True), field('updated_at',readonly=True)]
SCORES = [field('likelihood','number',3,minimum=1,maximum=5),field('impact','number',3,minimum=1,maximum=5),
          field('residual_likelihood','number',2,minimum=1,maximum=5),field('residual_impact','number',2,minimum=1,maximum=5)]


def resource(label, singular, statuses, fields):
    return dict(label=label, singular=singular, statuses=statuses.split(','),
                fields=COMMON + [choice('status',statuses)] + fields)


RESOURCES = {
    'frameworks': resource('Frameworks','Framework','not_started,in_progress,ready',[
        field('code'),field('version'),field('source_url','url'),field('guidance','textarea')]),
    'controls': resource('Controls','Control','not_started,in_progress,implemented,not_applicable',[
        field('code'),field('category'),ref('framework_ids','frameworks',True),field('implementation','textarea'),
        ref('evidence_ids','evidence',True),ref('policy_ids','policies',True),choice('frequency','annual,quarterly,monthly,continuous')]),
    'policies': resource('Policies','Policy','draft,in_review,published,archived',[
        field('content','textarea',max_length=500000),ref('control_ids','controls',True),*dates('review_date'),
        field('version','number',1,readonly=True),field('approved_at',default=None,readonly=True),field('approver')]),
    'vendors': resource('Vendors','Vendor','intake,in_review,approved,rejected,offboarded',[
        field('website','url'),field('category'),choice('tier','low,medium,high,critical','medium'),field('data_access','textarea'),
        field('contact_email','email'),*dates('renewal_date','review_date'),*SCORES,field('assessment_notes','textarea'),ref('evidence_ids','evidence',True)]),
    'risks': resource('Risks','Risk','identified,assessing,treating,accepted,closed',[
        field('category'),*SCORES,field('treatment','textarea'),ref('control_ids','controls',True),ref('vendor_id','vendors'),
        field('inherent_score','number',9,readonly=True),field('residual_score','number',4,readonly=True)]),
    'evidence': resource('Evidence','Evidence','collected,in_review,approved,expired',[
        choice('source','manual,link,import'),field('url','url'),ref('control_ids','controls',True),*dates('collected_date','expires_date'),
        field('filename',default=None,readonly=True),field('file_size','number',None,readonly=True),field('sha256',default=None,readonly=True)]),
    'audits': resource('Audits','Audit','planning,in_progress,in_review,complete',[
        ref('framework_id','frameworks'),*dates('period_start','period_end'),field('auditor')]),
    'audit_requests': resource('Audit requests','Audit request','open,in_progress,submitted,accepted',[
        ref('audit_id','audits',required=True),ref('control_id','controls'),ref('evidence_ids','evidence',True)]),
    'tasks': resource('Tasks','Task','todo,in_progress,blocked,done',[
        choice('priority','low,medium,high,urgent','medium'),field('related_type'),field('related_id'),field('checklist','json',[])]),
    'people': resource('People','Person','onboarding,active,offboarding,inactive',[
        field('email','email'),field('department'),field('role'),*dates('start_date'),field('training_completed','boolean',False),
        *dates('training_due'),ref('acknowledged_policy_ids','policies',True)]),
    'assets': resource('Assets','Asset','active,in_review,retired',[
        choice('category','hardware,software,cloud,data,other'),field('identifier'),field('system'),
        field('encrypted','boolean',None,nullable=True),field('mfa_enabled','boolean',None,nullable=True),*dates('last_reviewed')]),
    'access_reviews': resource('Access reviews','Access review','draft,in_progress,completed',[
        field('system'),field('reviewer'),field('entries','json',[])]),
    'questionnaires': resource('Questionnaires','Questionnaire','draft,in_progress,in_review,complete',[
        field('customer'),field('questions','json',[])]),
    'exceptions': resource('Exceptions','Exception','requested,approved,rejected,expired',[
        ref('control_id','controls'),field('reason','textarea'),*dates('expires_date'),field('approver')]),
}


def require_resource(name):
    if name not in RESOURCES:
        raise HTTPException(404, 'Unknown resource')
    return RESOURCES[name]


def fail(key, message):
    raise HTTPException(422, f'{key}: {message}')


def validate(resource_name, payload, existing=None):
    schema = require_resource(resource_name)
    fields = {f['key']:f for f in schema['fields']}
    result = deepcopy(existing) if existing else {k:deepcopy(f['default']) for k,f in fields.items() if k not in {'id','created_at','updated_at'}}
    for key,value in payload.items():
        if key not in fields or fields[key].get('readonly'):
            fail(key,'unknown or read-only field')
        f = fields[key]
        kind = f['type']
        if kind in {'text','textarea','url','email'}:
            if not isinstance(value,str) or len(value) > f.get('max_length', 100000 if kind=='textarea' else 2000) or '\x00' in value:
                fail(key,'invalid text or length')
            if kind=='url' and value:
                try:
                    parsed = urlsplit(value)
                    if parsed.scheme not in {'http','https'} or not parsed.hostname or parsed.username or parsed.password:
                        fail(key,'expected http(s) URL without credentials')
                except ValueError:
                    fail(key,'invalid URL')
            if kind=='email' and value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value):
                fail(key,'invalid email')
        elif kind=='date':
            if value is not None:
                try:
                    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
                        raise ValueError()
                    date.fromisoformat(value)
                except ValueError:
                    fail(key,'expected a valid YYYY-MM-DD date or null')
        elif kind=='number':
            if type(value) is not int or not f.get('minimum',-10**9) <= value <= f.get('maximum',10**9):
                fail(key,'expected integer in allowed range')
        elif kind=='boolean':
            if type(value) is not bool and not (value is None and f.get('nullable')):
                fail(key,'expected boolean' + (' or null' if f.get('nullable') else ''))
        elif kind=='select':
            if f.get('ref'):
                if value is not None and (not isinstance(value,str) or len(value)>100):
                    fail(key,'expected record ID or null')
            elif value not in f['options'] or not isinstance(value,str):
                fail(key,'invalid selection')
        elif kind=='multiselect':
            if not isinstance(value,list) or len(value)>5000 or any(not isinstance(v,str) or len(v)>240 for v in value):
                fail(key,'expected an array of strings')
            value = list(dict.fromkeys(value))
        elif kind=='json':
            if not isinstance(value,list) or len(value)>5000:
                fail(key,'expected array, maximum 5000 entries')
        result[key] = value
    for key,f in fields.items():
        if f.get('required') and not result.get(key):
            fail(key,'required')
    if not result['title'].strip():
        fail('title','must not be blank')
    return result


def public_schema():
    return {'resources':{name:{**meta,'fields':[{k:v for k,v in f.items() if k not in {'default','ref','minimum','maximum','nullable','max_length'}} for f in meta['fields']]} for name,meta in RESOURCES.items()}}
