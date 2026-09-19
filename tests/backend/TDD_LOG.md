# Backend vertical TDD evidence

All commands use project `.venv/bin/python -m pytest` with temporary data directories. No acceptance fixture is written to production `data/`.

- Slice 01 health/factory RED: `tests/backend/test_core.py -q` → 1 failed (missing server module, expected initial missing feature). GREEN → 1 passed.
- Slice 02 persistent workspace/session gate RED → bootstrap 404. GREEN → 2 passed.
- Slice 03 shared schema/CRUD engine parameterized over 14 resources RED → missing schema endpoint (14 failures). GREEN full suite → 16 passed.
