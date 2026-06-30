"""
SQLAlchemy model for agent run records.

One row per agent invocation. Lets the dashboard show "what did each agent
do for patient X today" and lets the abstract's evaluation plan compute
admin-action throughput per agent / per clinic / per time window.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Float, Index, Integer, String, Text, JSON,
)

from app.database import Base


class AgentRun(Base):
    """One invocation of one agent on one inbound message."""
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    # Stable per-run UUID assigned by the agent base class.
    run_id = Column(String(80), nullable=False, unique=True, index=True)
    agent_id = Column(String(80), nullable=False, index=True)
    # Inbound relay message that triggered this run.
    message_id = Column(String(80), nullable=False, index=True)
    # Patient identifier from the source EHR (MRN). Null when an agent's
    # work isn't patient-scoped (e.g. pure relay-health checks).
    external_patient_id = Column(String(160), nullable=True, index=True)

    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # Float seconds-since-epoch — convenient for downstream time-motion math.
    started_at_unix = Column(Float, nullable=False)
    duration_ms = Column(Float, nullable=True)

    # "skipped" | "succeeded" | "failed" | "flagged"
    status = Column(String(16), nullable=False, index=True)

    # Whatever the agent produced. PHI-safe by contract — agents must NOT
    # put raw PHI here; only summaries, references, decision flags, etc.
    output = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)


# Common forensic / dashboard queries.
Index(
    "ix_agent_runs_agent_status_time",
    AgentRun.agent_id, AgentRun.status, AgentRun.started_at,
)
Index(
    "ix_agent_runs_patient_time",
    AgentRun.external_patient_id, AgentRun.started_at,
)
