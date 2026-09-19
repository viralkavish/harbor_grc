"""Full workspace search across all resources."""
from .schema import RESOURCES
from .storage import Store


def search_workspace(store, query: str, limit: int = 50):
    if not query or not query.strip():
        return {'results': []}

    q = query.strip().casefold()
    results = []

    with store.transaction() as db:
        for resource in RESOURCES:
            records = Store.records(db, resource)
            for r in records:
                title = r.get('title', '')
                description = r.get('description', '')
                code = r.get('code', '')
                owner = r.get('owner', '')
                content = r.get('content', '')

                searchable = f"{title} {description} {code} {owner} {content}".casefold()
                if q in searchable:
                    # Find snippet around query match
                    snippet = ""
                    idx = searchable.find(q)
                    start = max(0, idx - 40)
                    end = min(len(searchable), idx + len(q) + 40)
                    snippet = searchable[start:end].replace('\n', ' ').strip()
                    if start > 0:
                        snippet = "..." + snippet
                    if end < len(searchable):
                        snippet = snippet + "..."

                    results.append({
                        'resource': resource,
                        'id': r['id'],
                        'title': title,
                        'status': r.get('status', ''),
                        'snippet': snippet or description[:100]
                    })
                    if len(results) >= limit:
                        return {'results': results}

    return {'results': results}
