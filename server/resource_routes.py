"""Allowlisted schema-driven HTTP resource routes."""
import json
from fastapi import APIRouter, HTTPException
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

    @router.get('/controls/catalog_meta')
    def control_catalog_meta():
        from .tsc_catalog import CATALOG_VINTAGE, TSC_CATALOG
        cc_count = sum(1 for c in TSC_CATALOG if c['code'].startswith('CC'))
        a_count = sum(1 for c in TSC_CATALOG if c['code'].startswith('A'))
        c_count = sum(1 for c in TSC_CATALOG if c['code'].startswith('C') and not c['code'].startswith('CC'))
        pi_count = sum(1 for c in TSC_CATALOG if c['code'].startswith('PI'))
        p_count = sum(1 for c in TSC_CATALOG if c['code'].startswith('P') and not c['code'].startswith('PI'))
        return {
            "vintage": CATALOG_VINTAGE,
            "total_criteria": len(TSC_CATALOG),
            "breakdown": {
                "common_criteria": cc_count,
                "availability": a_count,
                "confidentiality": c_count,
                "processing_integrity": pi_count,
                "privacy": p_count,
            }
        }

    @router.get('/controls/{control_id}/versions')
    def list_control_versions(control_id: str):
        with store.transaction() as db:
            rows = db.execute(
                "SELECT id, control_id, version, body, created_at FROM control_versions WHERE control_id=? ORDER BY version DESC",
                (control_id,)
            ).fetchall()
            versions = [
                {
                    "id": r[0],
                    "control_id": r[1],
                    "version": r[2],
                    "body": json.loads(r[3]),
                    "created_at": r[4]
                }
                for r in rows
            ]
            return {"control_id": control_id, "versions": versions}

    @router.get('/controls/{control_id}/versions/{version_num}')
    def get_control_version(control_id: str, version_num: int):
        with store.transaction() as db:
            row = db.execute(
                "SELECT id, control_id, version, body, created_at FROM control_versions WHERE control_id=? AND version=?",
                (control_id, version_num)
            ).fetchone()
            if not row:
                raise HTTPException(404, f"Version {version_num} for control {control_id} not found")
            return {
                "id": row[0],
                "control_id": row[1],
                "version": row[2],
                "body": json.loads(row[3]),
                "created_at": row[4]
            }

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
