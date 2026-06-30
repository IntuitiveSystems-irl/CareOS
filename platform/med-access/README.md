# Medication Access Friction API

Secure BigQuery-backed survey analysis service for detecting medication adherence barriers from All of Us `ds_survey` data.

## Architecture

```
Client → [API Key / JWT Auth] → FastAPI → [Template Allowlist] → [Parameterized BQ Query] → Aggregated JSON
                                    ↓
                              [Audit Log]
```

**Security guarantees:**
- No raw SQL accepted from clients — all queries use allowlisted templates
- Parameterized BigQuery execution prevents injection
- Only aggregated counts returned — no `person_id` or row-level data
- Every query execution is logged with caller identity, template, params, row counts
- Dual auth: API key (service-to-service) or JWT (user sessions)

## Quick Start

```bash
cd med-access
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your WORKSPACE_CDR and API key

uvicorn app.main:app --reload --port 8090
```

## Friction Taxonomy (Survey Signals)

### A) Cost-Friction Layer
| Signal | question_concept_id |
|--------|-------------------|
| Delayed Filling Rx To Save Money | 43530415 |
| Skipped Med To Save Money | 43530416 |
| Took Less Med To Save Money | 43530417 |
| Lower Cost Rx To Save Money | 43530413 |
| Prescription Medicines (afford) | 43530411 |
| Worried About Paying | 43530557 |
| Can't Afford Co-pay | 43530583 |
| Had To Pay Out Of Pocket | 43530584 |

### B) Insurance Context Layer
| Signal | question_concept_id |
|--------|-------------------|
| Health insurance coverage | 1332874, 1332737, 43530559 |
| *(Search by keyword for additional)* | — |

### C) Trust + Communication Layer
Provider respect/listening questions — use keyword search (`respect`, `listen`, `trust`).
Returns Likert/frequency distributions + simplified Yes/No/Skip tally.

### D) Follow-through Blockers (Future)
Prior auth, prescription denied, labs not complete — not in ds_survey.
Hooks reserved for OMOP EHR domains: `drug_exposure`, `measurement`, `procedure_occurrence`, `visit_occurrence`.

## API Endpoints

### Authentication

```bash
# Get a JWT token (requires API key)
curl -X POST http://localhost:8090/api/auth/token \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"subject": "analyst-1"}'

# Response:
# {"access_token": "eyJ...", "token_type": "bearer", "expires_in_minutes": 60}
```

All query endpoints accept **either** `X-API-Key` header **or** `Authorization: Bearer <jwt>`.

### GET /api/survey/answers-by-qid

Aggregated answer distribution for a single question.

```bash
# Cost friction: "Delayed Filling Rx To Save Money"
curl "http://localhost:8090/api/survey/answers-by-qid?qid=43530415" \
  -H "X-API-Key: YOUR_API_KEY"

# Response:
# {
#   "qid": 43530415,
#   "question": "Can't Afford Care: Delayed Filling Rx To Save Money",
#   "counts": [
#     {"answer": "Can't Afford Care: No", "n": 185234},
#     {"answer": "Can't Afford Care: Yes", "n": 42891},
#     {"answer": "PMI: Skip", "n": 3102}
#   ],
#   "total_n": 231227
# }
```

### POST /api/survey/bucketed-counts

Yes/No/Skip bucketed counts for multiple questions at once.

```bash
# All cost-friction signals
curl -X POST http://localhost:8090/api/survey/bucketed-counts \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "qids": [43530415, 43530416, 43530417, 43530413, 43530411, 43530557],
    "bucket_map": "yes/no/skip"
  }'

# Response:
# [
#   {"qid": 43530415, "question": "...", "Yes": 42891, "No": 185234, "Skip": 3102, "total": 231227},
#   {"qid": 43530416, "question": "...", "Yes": 38100, "No": 189500, "Skip": 3627, "total": 231227},
#   ...
# ]
```

### GET /api/survey/search-questions

Search question texts by keyword.

```bash
# Find insurance-related questions
curl "http://localhost:8090/api/survey/search-questions?keywords=insurance,coverage,medication&limit=10" \
  -H "X-API-Key: YOUR_API_KEY"

# Response:
# [
#   {"question_concept_id": 1332874, "question": "Health Insurance: ..."},
#   {"question_concept_id": 43530559, "question": "...coverage..."},
#   ...
# ]
```

### GET /api/survey/templates

List available query templates.

```bash
curl http://localhost:8090/api/survey/templates \
  -H "X-API-Key: YOUR_API_KEY"

# Response:
# [
#   {"template_id": "answers_by_qid", "description": "Aggregated answer counts for a single question_concept_id"},
#   {"template_id": "bucketed_counts", "description": "Answer counts for multiple qids (bucketed in Python)"},
#   {"template_id": "search_questions", "description": "Search question texts by keyword (LIKE match, LIMIT capped)"}
# ]
```

### GET /admin/audit

View recent query audit trail.

```bash
curl "http://localhost:8090/admin/audit?last_n=5" \
  -H "X-API-Key: YOUR_API_KEY"

# Response:
# [
#   {
#     "timestamp": "2026-03-05T15:48:12.345678+00:00",
#     "caller_subject": "analyst-1",
#     "caller_auth_method": "jwt",
#     "template_id": "answers_by_qid",
#     "parameters": {"qid": 43530415},
#     "workspace_cdr": "fc-aou-cdr-prod-ct.C2022Q4R9",
#     "row_count": 3,
#     "duration_ms": 1234.56,
#     "error": null
#   }
# ]
```

## Bucket Logic

| Bucket | Matches |
|--------|---------|
| **Yes** | `yes`, `y`, `true`, `...: Yes` (case-insensitive) |
| **No** | `no`, `n`, `false`, `...: No` (case-insensitive) |
| **Skip** | `null`, empty, `PMI: Skip`, `PMI: Prefer Not To Answer`, `PMI: Dont Know`, anything else |

Rules are configurable via `BucketRules` dataclass. Pass custom rules to `bucket_rows()`.

## Query Templates (Allowlist)

| ID | SQL Pattern | Parameters |
|----|-------------|------------|
| `answers_by_qid` | `SELECT answer, COUNT(*) ... WHERE question_concept_id = @qid GROUP BY ...` | `qid: int` |
| `bucketed_counts` | `SELECT answer, COUNT(*) ... WHERE question_concept_id IN UNNEST(@qids) GROUP BY ...` | `qids: list[int]` |
| `search_questions` | `SELECT DISTINCT question_concept_id, question ... WHERE LOWER(question) LIKE ... LIMIT @row_limit` | `keywords: list[str], limit: int` |

**No other queries can be executed.** Any attempt to run ad-hoc SQL will be rejected.

## Project Structure

```
med-access/
├── .env.example
├── requirements.txt
├── README.md
├── app/
│   ├── __init__.py
│   ├── config.py              # Settings from env vars (WORKSPACE_CDR, keys)
│   ├── main.py                # FastAPI app + endpoints
│   ├── bigquery_client.py     # Secure BQ execution (parameterized only)
│   ├── query_templates.py     # Allowlisted templates A/B/C + validators
│   ├── bucket_logic.py        # Yes/No/Skip classification rules
│   ├── security.py            # API key + JWT auth + combined middleware
│   └── audit_log.py           # Provenance logging (in-memory + structured log)
└── tests/
    ├── __init__.py
    ├── test_bucket_logic.py   # Bucket classification + aggregation tests
    ├── test_query_templates.py # Validator + template registry + SQL builder tests
    └── test_security.py       # JWT creation + payload tests
```

## Test Plan

### Unit Tests (no BigQuery needed)

```bash
cd med-access
pip install pytest
pytest tests/ -v
```

| Test Suite | What it covers |
|------------|---------------|
| `test_bucket_logic.py` | Yes/No/Skip classification for all patterns, edge cases (null, PMI codes, Likert), custom rules, row aggregation |
| `test_query_templates.py` | Parameter validation (qid, qid list, keywords, limit), template registry lookup, SQL builder output structure |
| `test_security.py` | JWT creation, payload claims, expiry |

### Integration Tests (requires BigQuery access)

Run manually with a valid `WORKSPACE_CDR`:

```bash
# 1. Health check
curl http://localhost:8090/health

# 2. Search for cost-related questions
curl "http://localhost:8090/api/survey/search-questions?keywords=afford,cost,medication&limit=10" \
  -H "X-API-Key: YOUR_API_KEY"

# 3. Get answer distribution for a known cost-friction QID
curl "http://localhost:8090/api/survey/answers-by-qid?qid=43530415" \
  -H "X-API-Key: YOUR_API_KEY"

# 4. Bucketed counts for all cost-friction QIDs
curl -X POST http://localhost:8090/api/survey/bucketed-counts \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"qids": [43530415,43530416,43530417,43530413,43530411,43530557,43530583,43530584]}'

# 5. Verify audit trail captured all queries
curl "http://localhost:8090/admin/audit?last_n=10" -H "X-API-Key: YOUR_API_KEY"

# 6. Verify auth rejection (should return 401)
curl "http://localhost:8090/api/survey/answers-by-qid?qid=43530415"

# 7. Verify invalid template rejection (no raw SQL path exists)
# (There is no endpoint that accepts raw SQL — this is by design)
```

### Security Tests

| Test | Expected |
|------|----------|
| No auth header | 401 |
| Wrong API key | 401 |
| Expired JWT | 401 |
| Invalid qid (negative) | 400 |
| Keywords with SQL injection chars | 400 |
| qids list > 50 items | 400 |
| limit > 100 | 400 |
| Unknown template_id | 400 (no endpoint exists) |
| Response contains person_id | **Never** — queries use COUNT(*) + GROUP BY only |
