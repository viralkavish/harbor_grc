"""CSV export with formula injection protection and transactional CSV import."""
import csv
import io
import json
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from .schema import RESOURCES, require_resource, validate
from .storage import Store, now
from .records import save, log
from .relations import validate_links, sync_links

ALLOWED_IMPORT_RESOURCES = {'controls', 'vendors', 'risks', 'tasks', 'people', 'assets'}
FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def sanitize_for_csv(val):
    if val is None:
        return ''
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, list):
        return json.dumps(val)
    if isinstance(val, dict):
        return json.dumps(val)

    s = str(val)
    if s.startswith(FORMULA_PREFIXES):
        return "'" + s
    return s


def csv_router(store):
    router = APIRouter(prefix='/api')

    @router.get('/export/{resource}')
    def export_csv(resource: str):
        require_resource(resource)
        schema_dict: dict = RESOURCES[resource]
        fields_list: list[dict] = schema_dict['fields']
        field_keys = [f['key'] for f in fields_list]

        with store.transaction() as db:
            records = Store.records(db, resource)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(field_keys)

        for r in records:
            row = [sanitize_for_csv(r.get(k)) for k in field_keys]
            writer.writerow(row)

        return Response(
            content=output.getvalue(),
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename="{resource}.csv"',
                'X-Content-Type-Options': 'nosniff'
            }
        )

    @router.post('/import/{resource}')
    async def import_csv(
        resource: str,
        file: UploadFile = File(...),
        dry_run: str = Form("false")
    ):
        if resource not in ALLOWED_IMPORT_RESOURCES:
            raise HTTPException(422, f"CSV import not supported for '{resource}'. Allowed: {', '.join(sorted(ALLOWED_IMPORT_RESOURCES))}")

        schema_dict: dict = require_resource(resource)
        fields_list: list[dict] = schema_dict['fields']
        fields_by_key: dict[str, dict] = {f['key']: f for f in fields_list}
        content = await file.read()

        try:
            text = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            raise HTTPException(422, "Invalid file encoding; UTF-8 CSV expected")

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(422, "CSV file is empty or missing headers")

        errors = []
        parsed_items = []

        with store.transaction() as db:
            for idx, row in enumerate(reader, start=2):
                payload = {}
                row_errs = []

                for k, v in row.items():
                    if not k or k not in fields_by_key:
                        continue
                    if fields_by_key[k].get('readonly'):
                        continue

                    f_kind = fields_by_key[k]['type']
                    clean_v = v.strip() if v else ''

                    # Strip formula escape prefix if user exported then re-imported
                    if clean_v.startswith("'") and len(clean_v) > 1 and clean_v[1] in FORMULA_PREFIXES:
                        clean_v = clean_v[1:]

                    if f_kind == 'number':
                        if clean_v == '':
                            payload[k] = fields_by_key[k].get('default', 0)
                        else:
                            try:
                                payload[k] = int(clean_v)
                            except ValueError:
                                row_errs.append(f"{k}: expected integer, got '{clean_v}'")
                    elif f_kind == 'boolean':
                        if clean_v.lower() in ('true', '1', 'yes'):
                            payload[k] = True
                        elif clean_v.lower() in ('false', '0', 'no'):
                            payload[k] = False
                        elif fields_by_key[k].get('nullable') and clean_v == '':
                            payload[k] = None
                        else:
                            row_errs.append(f"{k}: expected boolean")
                    elif f_kind in ('multiselect', 'json'):
                        if clean_v.startswith('[') and clean_v.endswith(']'):
                            try:
                                payload[k] = json.loads(clean_v)
                            except Exception:
                                row_errs.append(f"{k}: invalid JSON array")
                        elif clean_v:
                            payload[k] = [x.strip() for x in clean_v.split(',') if x.strip()]
                        else:
                            payload[k] = []
                    elif f_kind == 'date':
                        payload[k] = clean_v if clean_v else None
                    else:
                        payload[k] = clean_v

                try:
                    validated = validate(resource, payload)
                    validate_links(db, resource, validated)
                    parsed_items.append(validated)
                except HTTPException as ex:
                    row_errs.append(str(ex.detail))

                if row_errs:
                    errors.append({'row': idx, 'message': '; '.join(row_errs)})

            if errors:
                raise HTTPException(422, detail={
                    'errors': errors,
                    'message': f"CSV validation failed on {len(errors)} row(s): {errors[0]['message']} (row {errors[0]['row']})"
                })

            is_dry_run = dry_run.lower() in ('true', '1', 'yes')
            if is_dry_run:
                return {'imported': 0, 'preview': parsed_items, 'errors': []}

            # Transactional commit of all records
            for item in parsed_items:
                item.update(id=str(uuid4()), created_at=now(), updated_at=now())
                save(db, resource, item)
                sync_links(db, resource, item)

            log(db, 'import', resource, {'title': f"Imported {len(parsed_items)} {resource}"}, {'count': len(parsed_items)})
            return {'imported': len(parsed_items), 'preview': [], 'errors': []}

    return router
