"""
Medication Access Friction — FastAPI service.

Provides secure, aggregated survey analysis endpoints backed by BigQuery.
All queries use allowlisted templates with parameterized execution.
No raw SQL accepted from clients. No person-level data returned.

Endpoints:
  GET  /api/survey/answers-by-qid?qid=<int>
  POST /api/survey/bucketed-counts
  GET  /api/survey/search-questions?keywords=<csv>&limit=<int>
  GET  /api/survey/templates           (list available query templates)
  POST /api/auth/token                 (obtain JWT for session auth)
  GET  /admin/audit?last_n=<int>       (recent audit trail)
  GET  /health                         (health check)
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.security import require_auth, create_access_token, verify_api_key
from app.query_templates import get_template, list_templates, TEMPLATE_REGISTRY
from app.bigquery_client import execute_parameterized_query
from app.bucket_logic import bucket_rows, BucketRules
from app.audit_log import log_query_execution, get_audit_trail

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Medication Access Friction API",
    description="Secure BigQuery-backed survey analysis for medication access barriers",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic request/response models ──

class BucketedCountsRequest(BaseModel):
    qids: list[int] = Field(..., min_length=1, max_length=50, description="List of question_concept_ids")
    bucket_map: str = Field(default="yes/no/skip", description="Bucket mapping strategy (currently only 'yes/no/skip')")


class BucketedCountsItem(BaseModel):
    qid: int
    question: str
    Yes: int
    No: int
    Skip: int
    total: int


class AnswerCount(BaseModel):
    answer: Optional[str]
    n: int


class AnswersByQidResponse(BaseModel):
    qid: int
    question: str
    counts: list[AnswerCount]
    total_n: int


class SearchQuestionItem(BaseModel):
    question_concept_id: int
    question: str


class TokenRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100, description="User or service identifier")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


# ── Helper: execute template with audit logging ──

def _execute_with_audit(template_id: str, params: dict, caller: dict) -> list[dict]:
    """Execute a query template and log provenance."""
    template = get_template(template_id)

    # Validate required params
    for rp in template.required_params:
        if rp not in params:
            raise HTTPException(status_code=400, detail=f"Missing required parameter: {rp}")

    t0 = time.perf_counter()
    error_msg = None
    rows = []

    try:
        sql, bq_params = template.sql_builder(params)
        rows = execute_parameterized_query(sql, bq_params)
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        logger.exception("Query execution failed: %s", e)
        raise HTTPException(status_code=500, detail="Query execution failed")
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000
        log_query_execution(
            caller=caller,
            template_id=template_id,
            parameters=params,
            row_count=len(rows),
            duration_ms=duration_ms,
            error=error_msg,
        )

    return rows


# ── Endpoints ──

@app.get("/api/survey/answers-by-qid", response_model=AnswersByQidResponse)
async def answers_by_qid(
    qid: int = Query(..., gt=0, description="question_concept_id"),
    caller: dict = Depends(require_auth),
):
    """
    Aggregated answer distribution for a single question_concept_id.
    Returns answer values with counts — no person-level data.
    """
    rows = _execute_with_audit("answers_by_qid", {"qid": qid}, caller)

    if not rows:
        raise HTTPException(status_code=404, detail=f"No data found for question_concept_id={qid}")

    question_text = rows[0].get("question", "") if rows else ""
    counts = [AnswerCount(answer=r.get("answer"), n=r.get("n", 0)) for r in rows]
    total = sum(c.n for c in counts)

    return AnswersByQidResponse(qid=qid, question=question_text, counts=counts, total_n=total)


@app.post("/api/survey/bucketed-counts", response_model=list[BucketedCountsItem])
async def bucketed_counts(
    body: BucketedCountsRequest,
    caller: dict = Depends(require_auth),
):
    """
    Bucketed (Yes/No/Skip) answer counts for multiple question_concept_ids.
    Bucketing logic runs in Python (not SQL) for auditability.
    """
    if body.bucket_map != "yes/no/skip":
        raise HTTPException(status_code=400, detail="Only 'yes/no/skip' bucket_map is currently supported")

    rows = _execute_with_audit("bucketed_counts", {"qids": body.qids}, caller)

    if not rows:
        raise HTTPException(status_code=404, detail="No data found for the provided qids")

    bucketed = bucket_rows(rows, rules=BucketRules())

    return [
        BucketedCountsItem(**data)
        for data in bucketed.values()
    ]


@app.get("/api/survey/search-questions", response_model=list[SearchQuestionItem])
async def search_questions(
    keywords: str = Query(..., min_length=1, description="Comma-separated keywords"),
    limit: int = Query(default=25, ge=1, le=100, description="Max results"),
    caller: dict = Depends(require_auth),
):
    """
    Search distinct question texts by keyword.
    Returns question_concept_id + question text — no row-level data.
    """
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if not kw_list:
        raise HTTPException(status_code=400, detail="At least one keyword required")

    rows = _execute_with_audit(
        "search_questions",
        {"keywords": kw_list, "limit": limit},
        caller,
    )

    return [
        SearchQuestionItem(
            question_concept_id=r["question_concept_id"],
            question=r["question"],
        )
        for r in rows
    ]


@app.get("/api/survey/templates")
async def list_query_templates(caller: dict = Depends(require_auth)):
    """List all available query templates (for transparency)."""
    return list_templates()


# ── Auth endpoint ──

@app.post("/api/auth/token", response_model=TokenResponse)
async def issue_token(
    body: TokenRequest,
    _: str = Depends(verify_api_key),
):
    """
    Issue a JWT access token. Requires a valid API key.
    The JWT can then be used as Bearer auth for query endpoints.
    """
    token = create_access_token(subject=body.subject)
    return TokenResponse(
        access_token=token,
        expires_in_minutes=settings.JWT_EXPIRE_MINUTES,
    )


# ── Admin endpoint ──

@app.get("/admin/audit")
async def audit_trail(
    last_n: int = Query(default=50, ge=1, le=500),
    caller: dict = Depends(require_auth),
):
    """Return the most recent audit log entries."""
    return get_audit_trail(last_n=last_n)


# ── Health check ──

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "med-access-friction",
        "workspace_cdr_configured": bool(settings.WORKSPACE_CDR),
    }
