"""
Agent base class + registry.

An `Agent` is conceptually a `Transport` from the pipeline's perspective —
it sits at the end of a branch and consumes the message — but it carries
extra contract:

  * declares which messages it cares about via `should_process()`
  * each invocation produces an `AgentRunResult` row in `agent_runs`
  * each invocation emits an audit-log entry (action="phi_read" or
    "phi_write" depending on the agent's effect)

That contract lets us prove (for HIPAA + for the abstract's "EHR-log
analysis" evaluation plan) every administrative action the system took on
a patient's behalf.
"""
from __future__ import annotations

import abc
import enum
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    StageError,
    Transport,
)

logger = logging.getLogger(__name__)


# ── Result + status ─────────────────────────────────────────────────────────

class AgentStatus(str, enum.Enum):
    """Outcome of a single agent invocation."""
    skipped = "skipped"          # should_process() returned False
    succeeded = "succeeded"      # run() completed cleanly
    failed = "failed"            # run() raised
    flagged = "flagged"          # run() succeeded but flagged for clinician review


@dataclass
class AgentRunResult:
    """What an agent produced from one message."""
    agent_id: str
    message_id: str               # the inbound relay message that triggered the run
    status: AgentStatus
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    duration_ms: Optional[float] = None
    # Whatever the agent produced (PHI-safe summary, action list, etc.).
    # Stored as JSON in the agent_runs table.
    output: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    # Stable id (used as audit AAD when this run's output is encrypted).
    run_id: str = field(default_factory=lambda: f"run_{uuid.uuid4().hex}")
    # Patient identifier the agent acted on (when applicable). External
    # because agents work in MRN/source-id space, not the portal's user.id.
    external_patient_id: Optional[str] = None


# ── Registry ────────────────────────────────────────────────────────────────

_REGISTRY: dict[str, "Agent"] = {}


def register_agent(agent: "Agent") -> None:
    """Register an agent so the relay can dispatch messages to it."""
    if agent.agent_id in _REGISTRY:
        raise ValueError(f"Agent {agent.agent_id!r} already registered")
    _REGISTRY[agent.agent_id] = agent
    logger.info("registered agent %s", agent.agent_id)


def list_agents() -> list["Agent"]:
    return list(_REGISTRY.values())


def get_agent(agent_id: str) -> Optional["Agent"]:
    return _REGISTRY.get(agent_id)


def reset_agents_for_tests() -> None:
    """Force the agent registry empty. Tests only."""
    _REGISTRY.clear()


# ── Base class ──────────────────────────────────────────────────────────────

class Agent(Transport):
    """An agent is a Transport that wraps `run()` with bookkeeping.

    Subclasses implement:
      * `should_process(message)` — boolean filter (e.g. only ADT^A04)
      * `run(message, ctx)` — the actual work; returns AgentRunResult.output
      * Optionally override `actor_name` / `audit_action` for cleaner logs.

    The base class handles:
      * timing the run
      * inserting an `agent_runs` row (delegated to ctx.db_session_factory)
      * emitting an audit entry through ctx.audit_appender
      * propagating an `agent_results` list on `message.metadata` so
        downstream stages or routes can react to the run's output
    """

    name: str = "agent"
    agent_id: str = "agent"
    # Hint to operators / dashboards. Not a hard contract.
    description: str = ""
    actor_name: str = "careos.agent"

    # ── Subclass API ──

    @abc.abstractmethod
    def should_process(self, message: PipelineMessage) -> bool:
        """Return True if this agent should run on `message`."""

    @abc.abstractmethod
    async def run(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> AgentRunResult:
        """Do the work. Caller wraps with timing + persistence."""

    # ── Transport interface ──

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        if not self.should_process(message):
            return [message]   # pass-through; let other transports run

        started = time.time()
        try:
            result = await self.run(message, ctx)
        except StageError:
            raise
        except Exception as exc:  # noqa: BLE001
            duration = (time.time() - started) * 1000
            err_text = str(exc) or exc.__class__.__name__
            logger.exception("[%s] run failed for message %s",
                             self.agent_id, message.message_id)
            failed = AgentRunResult(
                agent_id=self.agent_id,
                message_id=message.message_id,
                status=AgentStatus.failed,
                started_at=started,
                finished_at=time.time(),
                duration_ms=duration,
                error=err_text[:500],
            )
            await self._persist(failed, message, ctx)
            # Don't bubble the exception up — one failed agent shouldn't
            # NACK the inbound HL7 message. The DB writer already committed.
            self._attach(message, failed)
            return [message]

        # Fill in timing the subclass didn't.
        if result.finished_at is None:
            result.finished_at = time.time()
        if result.duration_ms is None:
            result.duration_ms = (result.finished_at - started) * 1000
        if result.message_id is None:
            result.message_id = message.message_id
        if result.agent_id is None:
            result.agent_id = self.agent_id

        await self._persist(result, message, ctx)
        self._attach(message, result)
        return [message]

    # ── Helpers ──

    def _attach(self, message: PipelineMessage, result: AgentRunResult) -> None:
        """Stash the run result on the message so dashboards can show it."""
        results: list[dict[str, Any]] = message.metadata.setdefault("agent_results", [])
        results.append({
            "agent_id": result.agent_id,
            "run_id": result.run_id,
            "status": result.status.value,
            "duration_ms": result.duration_ms,
            "external_patient_id": result.external_patient_id,
            "error": result.error,
            # Output goes in too — it's PHI-safe by contract (agents must
            # not put raw PHI here; only summaries / refs / flags).
            "output": result.output,
        })

    async def _persist(
        self,
        result: AgentRunResult,
        message: PipelineMessage,
        ctx: PipelineContext,
    ) -> None:
        """Insert agent_runs row + audit entry. Best-effort: persistence
        failures are logged but don't propagate (the agent already ran)."""
        if ctx.db_session_factory is None or ctx.audit_appender is None:
            return

        # Late import — keeps this module importable in tests without
        # SQLAlchemy.
        from app.integration.agents.models import AgentRun
        from app.integration.audit.recorder import AuditAction

        import asyncio

        def _do_write() -> None:
            db = ctx.db_session_factory()
            try:
                row = AgentRun(
                    run_id=result.run_id,
                    agent_id=result.agent_id,
                    message_id=result.message_id,
                    external_patient_id=result.external_patient_id,
                    status=result.status.value,
                    started_at_unix=result.started_at,
                    duration_ms=result.duration_ms,
                    output=result.output or None,
                    error=result.error,
                )
                db.add(row)
                db.flush()
                # Map status → audit action.
                audit_action = (
                    AuditAction.error if result.status == AgentStatus.failed
                    else AuditAction.phi_read
                )
                ctx.audit_appender(
                    db,
                    actor=self.actor_name,
                    action=audit_action,
                    source_id=message.source_id,
                    target_id=f"agent.{self.agent_id}",
                    resource_type="AgentRun",
                    resource_id=result.run_id,
                    message_id=message.message_id,
                    extra={
                        "agent_id": self.agent_id,
                        "status": result.status.value,
                        "duration_ms": result.duration_ms,
                        "external_patient_id": result.external_patient_id,
                        "error": result.error,
                    },
                )
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("[%s] failed to persist run %s",
                                 self.agent_id, result.run_id)
            finally:
                db.close()

        try:
            await asyncio.to_thread(_do_write)
        except Exception:  # noqa: BLE001
            logger.exception("[%s] persistence thread failed", self.agent_id)
