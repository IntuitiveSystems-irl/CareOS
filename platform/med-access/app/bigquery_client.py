"""
Secure BigQuery client — executes only allowlisted parameterized queries.

All queries go through execute_template() which:
1. Validates the template ID against the allowlist
2. Substitutes parameters safely (BigQuery parameterized queries)
3. Logs execution provenance
4. Returns only aggregated results (no person_id exposure)
"""
from __future__ import annotations

import logging
import time
from typing import Any

from google.cloud import bigquery

from app.config import settings

logger = logging.getLogger(__name__)

_client: bigquery.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Lazy-init singleton BigQuery client."""
    global _client
    if _client is None:
        _client = bigquery.Client()
    return _client


def execute_parameterized_query(
    sql: str,
    query_params: list[bigquery.ScalarQueryParameter | bigquery.ArrayQueryParameter],
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    """
    Execute a parameterized BigQuery query and return rows as dicts.

    This is the ONLY function that touches BigQuery. All callers must
    go through the template system — never construct SQL from user input.
    """
    client = get_bq_client()

    job_config = bigquery.QueryJobConfig(
        query_parameters=query_params,
        dry_run=dry_run,
        use_query_cache=True,
    )

    t0 = time.perf_counter()
    query_job = client.query(sql, job_config=job_config)

    if dry_run:
        logger.info("Dry-run: would process %s bytes", query_job.total_bytes_processed)
        return []

    rows = [dict(row) for row in query_job.result()]
    elapsed = time.perf_counter() - t0

    logger.info(
        "BQ query executed: %.2fs, %d rows returned, %s bytes processed",
        elapsed, len(rows), query_job.total_bytes_processed,
    )
    return rows


def get_cdr_table(table_name: str) -> str:
    """
    Build fully-qualified table reference: `{WORKSPACE_CDR}.{table_name}`.

    The table_name is validated against a strict allowlist to prevent injection.
    """
    allowed_tables = {"ds_survey", "ds_condition", "ds_drug", "ds_measurement", "ds_person"}
    if table_name not in allowed_tables:
        raise ValueError(f"Table '{table_name}' is not in the allowlist: {allowed_tables}")
    return f"`{settings.WORKSPACE_CDR}.{table_name}`"
