"""Deterministic policy-backed suggestion engine for vendor/customer questionnaires.

Searches PUBLISHED policies only.
Never overwrites existing answers.
Clear provenance: records source policy IDs and marks suggestions as 'draft' for human review.
"""
import re
from fastapi import APIRouter, HTTPException
from .storage import Store, now
from .records import get_record, save, log

STOP_WORDS = {
    'what', 'does', 'your', 'have', 'with', 'from', 'this', 'that', 'they',
    'will', 'when', 'where', 'which', 'their', 'there', 'about', 'please',
    'describe', 'explain', 'provide', 'organization', 'company', 'security'
}


def extract_keywords(text: str) -> list[str]:
    words = re.findall(r'[a-zA-Z]{3,}', text.lower())
    return [w for w in words if w not in STOP_WORDS]


def suggest_answers_for_questionnaire(db, questionnaire_id: str):
    q_record = get_record(db, 'questionnaires', questionnaire_id)
    questions = q_record.get('questions', [])
    if not questions:
        return q_record

    # Retrieve PUBLISHED policies only
    policies = [p for p in Store.records(db, 'policies') if p.get('status') == 'published']
    if not policies:
        return q_record

    modified = False
    for q in questions:
        # Do not overwrite nonempty existing answers
        existing_answer = q.get('answer', '').strip()
        if existing_answer:
            continue

        q_text = q.get('question', '')
        keywords = extract_keywords(q_text)
        if not keywords:
            continue

        best_policy = None
        best_score = 0
        best_snippet = ""

        for p in policies:
            content = p.get('content', '')
            title = p.get('title', '')
            score = 0
            for kw in keywords:
                score += (content.lower().count(kw) * 1) + (title.lower().count(kw) * 3)

            if score > best_score and score >= 2:
                best_score = score
                best_policy = p

                # Find most relevant paragraph in policy content
                paragraphs = [para.strip() for para in content.split('\n\n') if para.strip()]
                best_para = ""
                best_para_score = 0
                for para in paragraphs:
                    if para.startswith('#'):
                        continue
                    p_score = sum(para.lower().count(kw) for kw in keywords)
                    if p_score > best_para_score:
                        best_para_score = p_score
                        best_para = para

                best_snippet = best_para or content[:300]

        if best_policy and best_snippet:
            clean_snippet = re.sub(r'#+\s*', '', best_snippet).strip()
            # Trim to reasonable length
            if len(clean_snippet) > 500:
                clean_snippet = clean_snippet[:497] + '...'
            q['answer'] = f"Per {best_policy['title']}: {clean_snippet}"
            q['status'] = 'draft'
            q['source_ids'] = [best_policy['id']]
            modified = True

    if modified:
        q_record['updated_at'] = now()
        save(db, 'questionnaires', q_record)
        log(db, 'suggest_answers', 'questionnaires', q_record, {'suggested': True})

    return q_record


def questionnaire_router(store):
    router = APIRouter(prefix='/api/questionnaires')

    @router.post('/{questionnaire_id}/suggest')
    def suggest_from_policies(questionnaire_id: str):
        with store.transaction() as db:
            return suggest_answers_for_questionnaire(db, questionnaire_id)

    return router
