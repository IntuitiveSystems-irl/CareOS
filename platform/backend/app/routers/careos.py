"""
CareOS dashboard / agent observability HTTP routes.

Mounted under /api/careos/*. PHI-safe — agents are required to keep raw PHI
out of `AgentRun.output`, so this router can return outputs verbatim.

  GET /api/careos/agents
  GET /api/careos/agents/{agent_id}/runs?limit=50
  GET /api/careos/runs/{run_id}
  GET /api/careos/patients/{external_id}/summary
  GET /api/careos/burden                  aggregate admin-savings stats
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.integration.agents.base import list_agents
from app.integration.agents.models import AgentRun

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/careos", tags=["careos"])


# ── Agents ──────────────────────────────────────────────────────────────────

@router.get("/agents")
def agents_index() -> dict:
    """List all registered CareOS agents."""
    return {
        "count": len(list_agents()),
        "agents": [
            {
                "agent_id": a.agent_id,
                "description": a.description,
                "actor_name": a.actor_name,
            }
            for a in list_agents()
        ],
    }


@router.get("/agents/{agent_id}/runs")
def agent_runs(
    agent_id: str,
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None, description="filter by status"),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(AgentRun).filter(AgentRun.agent_id == agent_id)
    if status:
        q = q.filter(AgentRun.status == status)
    rows = q.order_by(desc(AgentRun.started_at)).limit(limit).all()
    return {"count": len(rows), "runs": [_run_summary(r) for r in rows]}


@router.get("/runs/{run_id}")
def run_detail(run_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.query(AgentRun).filter(AgentRun.run_id == run_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="run_id not found")
    return _run_detail(row)


# ── Patient summary ─────────────────────────────────────────────────────────

@router.get("/patients/{external_id}/summary")
def patient_summary(
    external_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Latest IntakeAgent summary card for a patient (by external MRN)."""
    row = (
        db.query(AgentRun)
        .filter(
            AgentRun.external_patient_id == external_id,
            AgentRun.agent_id == "intake_agent",
        )
        .order_by(desc(AgentRun.started_at))
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No IntakeAgent run found for external_id={external_id}",
        )
    return {
        **_run_detail(row),
        "summary": row.output or {},
    }


# ── Burden / throughput aggregates ──────────────────────────────────────────

@router.get("/burden")
def burden_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> dict:
    """Aggregate admin-action savings across all agents in the past N days.

    The numbers come straight from each agent's self-reported
    `output.admin_savings.actions_replaced` / `minutes_saved_est` so we can
    refine the math per-agent later.
    """
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        db.query(AgentRun)
        .filter(AgentRun.started_at >= since)
        .filter(AgentRun.status.in_(["succeeded", "flagged"]))
    )
    total_actions = 0
    total_minutes = 0
    per_agent: dict[str, dict] = {}
    run_count = 0
    for r in q.yield_per(500):
        run_count += 1
        savings = ((r.output or {}).get("admin_savings") or {})
        actions = int(savings.get("actions_replaced") or 0)
        minutes = int(savings.get("minutes_saved_est") or 0)
        total_actions += actions
        total_minutes += minutes
        agg = per_agent.setdefault(r.agent_id, {
            "runs": 0, "actions_replaced": 0, "minutes_saved_est": 0,
        })
        agg["runs"] += 1
        agg["actions_replaced"] += actions
        agg["minutes_saved_est"] += minutes

    return {
        "window_days": days,
        "since": since.isoformat(),
        "total_runs": run_count,
        "actions_replaced": total_actions,
        "minutes_saved_est": total_minutes,
        "hours_saved_est": round(total_minutes / 60.0, 1),
        "per_agent": per_agent,
    }


# ── Helpers ─────────────────────────────────────────────────────────────────

def _run_summary(r: AgentRun) -> dict:
    return {
        "run_id": r.run_id,
        "agent_id": r.agent_id,
        "message_id": r.message_id,
        "external_patient_id": r.external_patient_id,
        "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "duration_ms": r.duration_ms,
        "error": r.error,
    }


def _run_detail(r: AgentRun) -> dict:
    return {
        **_run_summary(r),
        "output": r.output or {},
    }
