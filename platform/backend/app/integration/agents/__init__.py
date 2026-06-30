"""
CareOS workflow agents.

Agents are *consumers* of pipeline messages — they sit downstream of the
DB writer transport and react to specific message types (e.g. ADT^A04 →
IntakeAgent). Each agent run is recorded in the `agent_runs` table and
emits an audit entry, so a clinician or auditor can answer "what did the
system decide for this patient, when, and why" without re-running anything.

Three agents are planned (CareOS abstract layers (3a)–(3c)):

  IntakeAgent     ADT^A04 / A28 / A31  →  patient summary card
  LabLoopAgent    ORM^O01 + ORU^R01    →  ordered/received/charted state
  RxLoopAgent     RDE^O11 + RDS^O13    →  prescribed/dispensed/picked-up

Phase 1 implements only IntakeAgent; the others share this base class.
"""

from .base import (
    Agent,
    AgentRunResult,
    AgentStatus,
    register_agent,
)

__all__ = [
    "Agent",
    "AgentRunResult",
    "AgentStatus",
    "register_agent",
]
