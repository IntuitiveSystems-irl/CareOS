"""
Allowlisted query templates for the Medication Access Friction service.

Every query that touches BigQuery MUST be defined here as a named template.
The template system:
1. Maps a template_id to a SQL string with BigQuery @param placeholders
2. Defines which parameters are required and their types
3. Validates parameters before execution
4. Prevents any raw/ad-hoc SQL from reaching BigQuery

Templates:
  A — answers_by_qid: aggregated answer counts for a single question_concept_id
  B — bucketed_counts: answer counts bucketed into yes/no/skip for multiple qids
  C — search_questions: keyword search across question text with LIMIT
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from google.cloud import bigquery

from app.bigquery_client import get_cdr_table


# ── Template definitions ──

@dataclass
class QueryTemplate:
    """A validated, parameterized BigQuery query template."""
    template_id: str
    description: str
    sql_builder: Any  # callable(params) -> (sql_str, bq_params)
    required_params: list[str] = field(default_factory=list)
    param_validators: dict[str, Any] = field(default_factory=dict)


def _validate_qid(val: Any) -> int:
    """Validate a question_concept_id is a positive integer."""
    v = int(val)
    if v <= 0:
        raise ValueError(f"question_concept_id must be positive, got {v}")
    return v


def _validate_qid_list(val: Any) -> list[int]:
    """Validate a list of question_concept_ids."""
    if not isinstance(val, list) or len(val) == 0:
        raise ValueError("qids must be a non-empty list of integers")
    if len(val) > 50:
        raise ValueError("qids list cannot exceed 50 items")
    return [_validate_qid(v) for v in val]


def _validate_keywords(val: Any) -> list[str]:
    """Validate keyword list: alpha + spaces only, max 10 keywords."""
    if not isinstance(val, list) or len(val) == 0:
        raise ValueError("keywords must be a non-empty list of strings")
    if len(val) > 10:
        raise ValueError("keywords list cannot exceed 10 items")
    cleaned = []
    for kw in val:
        s = str(kw).strip()
        if not re.match(r"^[a-zA-Z0-9 _-]{1,60}$", s):
            raise ValueError(f"Invalid keyword: '{s}' — only alphanumeric, space, hyphen, underscore allowed")
        cleaned.append(s)
    return cleaned


def _validate_limit(val: Any) -> int:
    """Validate result limit: 1–100."""
    v = int(val)
    if v < 1 or v > 100:
        raise ValueError(f"limit must be 1–100, got {v}")
    return v


# ── Template A: answers by question_concept_id ──

def _build_answers_by_qid(params: dict) -> tuple[str, list]:
    """
    Aggregated answer distribution for a single question_concept_id.
    Returns (answer_value, count) pairs — NO person_id in output.
    """
    qid = _validate_qid(params["qid"])
    table = get_cdr_table("ds_survey")

    sql = f"""
        SELECT
            question_concept_id,
            question,
            answer,
            COUNT(*) AS n
        FROM {table}
        WHERE question_concept_id = @qid
        GROUP BY question_concept_id, question, answer
        ORDER BY n DESC
    """
    bq_params = [
        bigquery.ScalarQueryParameter("qid", "INT64", qid),
    ]
    return sql, bq_params


# ── Template B: bucketed counts for multiple qids ──

def _build_bucketed_counts(params: dict) -> tuple[str, list]:
    """
    For each qid, return answer + count. Bucketing is done in Python
    (not SQL) for flexibility and auditability.
    """
    qids = _validate_qid_list(params["qids"])
    table = get_cdr_table("ds_survey")

    sql = f"""
        SELECT
            question_concept_id,
            question,
            answer,
            COUNT(*) AS n
        FROM {table}
        WHERE question_concept_id IN UNNEST(@qids)
        GROUP BY question_concept_id, question, answer
        ORDER BY question_concept_id, n DESC
    """
    bq_params = [
        bigquery.ArrayQueryParameter("qids", "INT64", qids),
    ]
    return sql, bq_params


# ── Template C: search questions by keyword ──

def _build_search_questions(params: dict) -> tuple[str, list]:
    """
    Search distinct question texts by keyword (LIKE match).
    Returns question_concept_id + question text, no row-level data.
    """
    keywords = _validate_keywords(params["keywords"])
    limit = _validate_limit(params.get("limit", 25))
    table = get_cdr_table("ds_survey")

    # Build OR-chain of LIKE conditions using parameters
    like_clauses = []
    bq_params = []
    for i, kw in enumerate(keywords):
        pname = f"kw_{i}"
        like_clauses.append(f"LOWER(question) LIKE CONCAT('%', LOWER(@{pname}), '%')")
        bq_params.append(bigquery.ScalarQueryParameter(pname, "STRING", kw))

    where = " OR ".join(like_clauses)
    bq_params.append(bigquery.ScalarQueryParameter("row_limit", "INT64", limit))

    sql = f"""
        SELECT DISTINCT
            question_concept_id,
            question
        FROM {table}
        WHERE {where}
        LIMIT @row_limit
    """
    return sql, bq_params


# ── Template registry ──

TEMPLATE_REGISTRY: dict[str, QueryTemplate] = {
    "answers_by_qid": QueryTemplate(
        template_id="answers_by_qid",
        description="Aggregated answer counts for a single question_concept_id",
        sql_builder=_build_answers_by_qid,
        required_params=["qid"],
        param_validators={"qid": _validate_qid},
    ),
    "bucketed_counts": QueryTemplate(
        template_id="bucketed_counts",
        description="Answer counts for multiple qids (bucketed in Python)",
        sql_builder=_build_bucketed_counts,
        required_params=["qids"],
        param_validators={"qids": _validate_qid_list},
    ),
    "search_questions": QueryTemplate(
        template_id="search_questions",
        description="Search question texts by keyword (LIKE match, LIMIT capped)",
        sql_builder=_build_search_questions,
        required_params=["keywords"],
        param_validators={"keywords": _validate_keywords, "limit": _validate_limit},
    ),
}


def get_template(template_id: str) -> QueryTemplate:
    """Retrieve a template by ID, raising ValueError if not found."""
    if template_id not in TEMPLATE_REGISTRY:
        raise ValueError(
            f"Unknown template '{template_id}'. "
            f"Allowed: {list(TEMPLATE_REGISTRY.keys())}"
        )
    return TEMPLATE_REGISTRY[template_id]


def list_templates() -> list[dict[str, str]]:
    """List all available templates (for admin/debug)."""
    return [
        {"template_id": t.template_id, "description": t.description}
        for t in TEMPLATE_REGISTRY.values()
    ]
