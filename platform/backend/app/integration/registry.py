"""
Global relay registry — composes listeners + pipelines and exposes lifecycle
hooks for the FastAPI lifespan.

Right now there's a single HL7 MLLP listener feeding a single pipeline:

    HL7 MLLP listener
        → Hl7v2ToFhirTransform
        → single_branch("postgres")
        → PostgresFhirWriter

Adding a new listener (FHIR webhook, SFTP poll, etc.) is just appending to
`build_relay()` — the framework doesn't change.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from app.integration.audit.recorder import append_audit
from app.integration.listeners.hl7_mllp import Hl7MllpListener
from app.integration.pipeline import (
    Listener,
    Pipeline,
    PipelineContext,
    PipelineMessage,
)
from app.integration.routes.rule_router import single_branch
from app.integration.transforms.hl7v2_to_fhir import Hl7v2ToFhirTransform
from app.integration.transports.db_writer import PostgresFhirWriter

logger = logging.getLogger(__name__)


class Relay:
    """Container for all listeners + pipelines. Started/stopped as a unit."""

    def __init__(self) -> None:
        self._pipelines: dict[str, Pipeline] = {}
        self._listeners: list[Listener] = []
        self._started = False

    def register_pipeline(self, pipeline: Pipeline) -> None:
        if pipeline.name in self._pipelines:
            raise ValueError(f"Pipeline {pipeline.name!r} already registered")
        self._pipelines[pipeline.name] = pipeline

    def register_listener(
        self, listener: Listener, *, pipeline_name: str,
    ) -> None:
        pipeline = self._pipelines.get(pipeline_name)
        if pipeline is None:
            raise ValueError(f"Unknown pipeline {pipeline_name!r}")

        async def _on_message(msg: PipelineMessage):
            return await pipeline.dispatch(msg)

        listener.bind(_on_message)
        self._listeners.append(listener)

    async def start(self) -> None:
        if self._started:
            return
        for listener in self._listeners:
            try:
                await listener.start()
            except Exception:  # noqa: BLE001
                logger.exception("Relay: failed to start listener %s", listener.listener_id)
                # Carry on — other listeners can still serve.
        self._started = True

    async def stop(self) -> None:
        if not self._started:
            return
        for listener in self._listeners:
            try:
                await listener.stop()
            except Exception:  # noqa: BLE001
                logger.exception("Relay: error stopping listener %s", listener.listener_id)
        self._started = False

    @property
    def listeners(self) -> list[Listener]:
        return list(self._listeners)

    @property
    def pipelines(self) -> dict[str, Pipeline]:
        return dict(self._pipelines)

    def health(self) -> dict[str, object]:
        return {
            "started": self._started,
            "listeners": [l.health() for l in self._listeners],
            "pipelines": {n: p.stats() for n, p in self._pipelines.items()},
        }


# ── Singleton + builder ─────────────────────────────────────────────────────

_relay: Optional[Relay] = None


def get_relay() -> Relay:
    """Lazy singleton. Returns the active Relay (building it on first call)."""
    global _relay
    if _relay is None:
        _relay = build_relay()
    return _relay


def reset_relay_for_tests() -> None:
    """Force the singleton to be rebuilt on next `get_relay()`. Tests only."""
    global _relay
    _relay = None


def build_relay() -> Relay:
    """Wire up the default LaunchFlow relay topology.

    Env vars consulted:
      RELAY_HL7_MLLP_HOST   default 0.0.0.0
      RELAY_HL7_MLLP_PORT   default 2575
      RELAY_HL7_MLLP_PEERS  comma-separated allow-list (optional)
      RELAY_HL7_MLLP_TLS_CERT / _KEY / _CA   optional MLLP-over-TLS
      RELAY_HL7_MLLP_REQUIRE_CLIENT_CERT  "1" to require mTLS
    """
    relay = Relay()

    # Late-imported to keep this module importable even when SQLAlchemy
    # isn't ready (e.g. in unit tests stubbing the DB).
    from app.database import SessionLocal

    ctx = PipelineContext(
        pipeline_name="hl7_mllp_to_postgres",
        db_session_factory=lambda: SessionLocal(),
        audit_appender=append_audit,
    )

    # Agents run AFTER the DB writer in the same branch — that way the
    # relay_inbound_messages row is committed before any agent reads it,
    # and an agent failure can never roll back ingestion.
    from app.integration.agents.base import register_agent
    from app.integration.agents.intake import IntakeAgent

    intake_agent = IntakeAgent()
    register_agent(intake_agent)

    pipeline = Pipeline(
        name="hl7_mllp_to_postgres",
        source_transforms=[Hl7v2ToFhirTransform(strict=False)],
        route=single_branch("postgres"),
        branches={
            "postgres": [
                PostgresFhirWriter(target_id="postgres.relay"),
                intake_agent,
            ],
        },
        ctx=ctx,
    )
    relay.register_pipeline(pipeline)

    peers_env = os.environ.get("RELAY_HL7_MLLP_PEERS", "").strip()
    allowed_peers = (
        {p.strip() for p in peers_env.split(",") if p.strip()}
        if peers_env else None
    )

    tls_cert = os.environ.get("RELAY_HL7_MLLP_TLS_CERT") or None
    tls_key = os.environ.get("RELAY_HL7_MLLP_TLS_KEY") or None
    tls_ca = os.environ.get("RELAY_HL7_MLLP_TLS_CA") or None
    require_mtls = os.environ.get("RELAY_HL7_MLLP_REQUIRE_CLIENT_CERT") == "1"

    mllp_listener = Hl7MllpListener(
        host=os.environ.get("RELAY_HL7_MLLP_HOST", "0.0.0.0"),
        port=int(os.environ.get("RELAY_HL7_MLLP_PORT", "2575")),
        listener_id="hl7_mllp",
        source_id="hl7_mllp",
        allowed_peers=allowed_peers,
        tls_certfile=tls_cert,
        tls_keyfile=tls_key,
        client_ca_file=tls_ca,
        require_client_cert=require_mtls,
    )
    relay.register_listener(mllp_listener, pipeline_name="hl7_mllp_to_postgres")

    return relay
