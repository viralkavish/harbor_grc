"""Allowlisted schema-driven HTTP resource routes."""
from fastapi import APIRouter
from .schema import public_schema, require_resource, RESOURCES
from .records import get_record, create_record, update_record, delete_record, activity


def resource_router(store):
    router = APIRouter(prefix='/api')

    @router.get('/schema')
    def schema():
        return public_schema()

    @router.get('/activity')
    def activity_feed():
        with store.transaction() as db:
            return activity(db)

    @router.get('/{resource}')
    def list_records(resource: str, q: str='', status: str='', owner: str='', framework_id: str=''):
        require_resource(resource)
        with store.transaction() as db:
            items = store.records(db, resource)
        items = [r for r in items if
                 (not q or q.casefold() in (r.get('title', '') + ' ' + r.get('description', '') + ' ' + r.get('code', '')).casefold()) and
                 (not status or r.get('status') == status) and (not owner or r.get('owner') == owner) and
                 (not framework_id or framework_id in r.get('framework_ids', []) or r.get('framework_id') == framework_id)]
        return dict(items=items[:5000],total=len(items))

    @router.get('/{resource}/{record_id}')
    def read_record(resource: str, record_id: str):
        with store.transaction() as db:
            return get_record(db, resource, record_id)

    @router.post('/{resource}',status_code=201)
    def create(resource: str, payload: dict):
        with store.transaction() as db:
            return create_record(db, resource, payload)

    @router.patch('/{resource}/{record_id}')
    def update(resource: str, record_id: str, payload: dict):
        with store.transaction() as db:
            return update_record(db, resource, record_id, payload)

    @router.delete('/{resource}/{record_id}')
    def delete(resource: str, record_id: str):
        with store.transaction() as db:
            delete_record(db, resource, record_id)
        return {'deleted': True}

    return router
