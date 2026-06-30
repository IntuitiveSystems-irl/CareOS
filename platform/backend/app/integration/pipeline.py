"""
Pipeline orchestrator + stage abstractions.

A `Pipeline` chains: source_transform → route → (per-route) target_transform
→ transport. Each stage operates on a `PipelineMessage` and may emit zero,
one, or many downstream messages.

A `Listener` is *outside* the pipeline — it is a long-running process that
pushes raw `PipelineMessage`s into the pipeline as they arrive.

Concurrency model: each stage's `process()` is an async coroutine. The
orchestrator runs them sequentially per-message but processes many messages
concurrently. CPU-bound transforms should `asyncio.to_thread()` themselves.
"""
from __future__ import annotations

import abc
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ── Message envelope ────────────────────────────────────────────────────────

@dataclass
class PipelineMessage:
    """A single in-flight message moving through the pipeline.

    `body` evolves as the message flows: starts as raw bytes (e.g. an HL7v2
    string), becomes a dict (canonical FHIR resource), and finally whatever
    a transport expects (e.g. a SQLAlchemy mapping).
    """
    body: Any
    source_id: str                       # e.g. "epic_backend_sandbox", "va_lighthouse"
    content_type: str                    # e.g. "application/hl7-v2", "application/fhir+json"
    listener_id: str                     # which listener accepted this message
    # Stable per-message identifier — used as audit AAD and ack correlation.
    message_id: str = field(default_factory=lambda: f"msg_{uuid.uuid4().hex}")
    received_at: float = field(default_factory=time.time)
    headers: dict[str, str] = field(default_factory=dict)
    # Free-form metadata the pipeline appends as it runs (patient_id, etc.).
    metadata: dict[str, Any] = field(default_factory=dict)
    # Hash of the raw inbound body — used by the audit log to prove what
    # arrived matches what was processed.
    inbound_digest: Optional[str] = None


@dataclass
class PipelineContext:
    """Per-pipeline context: shared services available to all stages.

    Stages receive this alongside the message so they don't need to import
    globals (improves testability).
    """
    pipeline_name: str
    # Async session factory — stages call `async with ctx.session() as s:`
    db_session_factory: Optional[Callable[[], Any]] = None
    # Tamper-evident audit log appender; injected so tests can mock it.
    audit_appender: Optional[Callable[..., Any]] = None
    # Pipeline-scoped logger.
    logger: logging.Logger = field(default_factory=lambda: logger)


# ── Errors ──────────────────────────────────────────────────────────────────

class StageError(Exception):
    """Raised by a stage to signal a non-retryable failure.

    Subclasses signal whether the message should be NACK'd to the source
    (e.g. malformed HL7) or sent to the dead-letter queue (DB write failed).
    """
    def __init__(self, message: str, *, retryable: bool = False, code: str = "stage_error"):
        super().__init__(message)
        self.retryable = retryable
        self.code = code


# ── Stage abstractions ──────────────────────────────────────────────────────

class Stage(abc.ABC):
    """A unit of work in the pipeline. Operates on one message at a time."""

    name: str = "stage"

    @abc.abstractmethod
    async def process(
        self,
        message: PipelineMessage,
        ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        """Process `message`. Return zero, one, or many downstream messages.

        Returning [] discards the message (e.g. filtered out by a route).
        Raising `StageError` aborts processing for this message.
        """


class Transform(Stage):
    """Converts one message representation to another (same shape, new body)."""


class Route(Stage):
    """Decides which downstream pipeline branch(es) a message takes.

    Returns one message per chosen branch; the orchestrator dispatches each
    to its own `target_transform → transport` chain. The branch name lives
    in `message.metadata["route"]`.
    """


class Transport(Stage):
    """Terminal stage: delivers the message to its destination.

    Must be idempotent w.r.t. `message.message_id` — if a transport sees the
    same message_id twice it should detect and skip, not duplicate.
    """


# ── Listener abstraction ────────────────────────────────────────────────────

class Listener(abc.ABC):
    """A long-running source of inbound messages.

    Owns its own protocol (TCP socket, HTTP route, scheduled poll, etc.) and
    pushes `PipelineMessage`s into a callback the pipeline owner provides.
    """

    listener_id: str = "listener"

    def __init__(self):
        self._on_message: Optional[Callable[[PipelineMessage], "asyncio.Future"]] = None
        self._task: Optional[asyncio.Task] = None
        self._started_at: Optional[float] = None
        self._stats = ListenerStats()

    def bind(self, on_message: Callable[[PipelineMessage], "asyncio.Future"]) -> None:
        """Wire a callback that receives messages this listener produces."""
        self._on_message = on_message

    async def emit(self, message: PipelineMessage) -> Any:
        """Push a message to the bound pipeline. Returns whatever the
        pipeline returns (e.g. an ACK payload for the source)."""
        if self._on_message is None:
            raise RuntimeError(f"Listener {self.listener_id} has no bound callback")
        self._stats.received += 1
        try:
            result = await self._on_message(message)
            self._stats.acked += 1
            return result
        except Exception:
            self._stats.errored += 1
            raise

    @abc.abstractmethod
    async def start(self) -> None:
        """Begin accepting messages. Should return once the listener is ready."""

    @abc.abstractmethod
    async def stop(self) -> None:
        """Stop gracefully — drain in-flight work, then close resources."""

    def health(self) -> dict[str, Any]:
        return {
            "listener_id": self.listener_id,
            "running": self._started_at is not None,
            "uptime_seconds": (time.time() - self._started_at) if self._started_at else 0,
            "stats": self._stats.snapshot(),
        }


@dataclass
class ListenerStats:
    received: int = 0
    acked: int = 0
    errored: int = 0

    def snapshot(self) -> dict[str, int]:
        return {"received": self.received, "acked": self.acked, "errored": self.errored}


# ── Pipeline orchestrator ───────────────────────────────────────────────────

class Pipeline:
    """Composes a set of stages into a runnable pipeline.

    Stages run in this order:
        source_transform → route → (per branch) [target_transforms..., transport]

    A `Listener` calls `pipeline.dispatch(message)` and awaits the result.
    """

    def __init__(
        self,
        name: str,
        source_transforms: list[Transform],
        route: Route,
        branches: dict[str, list[Stage]],
        ctx: Optional[PipelineContext] = None,
    ):
        if not branches:
            raise ValueError("Pipeline must have at least one branch")
        self.name = name
        self.source_transforms = list(source_transforms)
        self.route = route
        self.branches = dict(branches)
        self.ctx = ctx or PipelineContext(pipeline_name=name)
        self._dispatched = 0
        self._completed = 0
        self._failed = 0

    async def dispatch(self, message: PipelineMessage) -> list[Any]:
        """Drive a single message all the way through the pipeline.

        Returns a list of per-branch terminal results (e.g. write receipts).
        Raises `StageError` if any stage fails non-retryably.
        """
        self._dispatched += 1
        try:
            # 1) Source transforms — sequential mutations of the message
            current_messages = [message]
            for transform in self.source_transforms:
                next_messages: list[PipelineMessage] = []
                for m in current_messages:
                    next_messages.extend(await transform.process(m, self.ctx))
                current_messages = next_messages
                if not current_messages:
                    self._completed += 1
                    return []

            # 2) Route — fan-out per branch
            results: list[Any] = []
            for m in current_messages:
                routed_messages = await self.route.process(m, self.ctx)
                for branch_msg in routed_messages:
                    branch_name = branch_msg.metadata.get("route")
                    if not branch_name or branch_name not in self.branches:
                        self.ctx.logger.warning(
                            "Pipeline %s: dropping message %s — no route or unknown branch %r",
                            self.name, branch_msg.message_id, branch_name,
                        )
                        continue
                    # 3) Per-branch target transforms + transport
                    branch_stages = self.branches[branch_name]
                    branch_messages = [branch_msg]
                    for stage in branch_stages:
                        outputs: list[PipelineMessage] = []
                        for bm in branch_messages:
                            outputs.extend(await stage.process(bm, self.ctx))
                        branch_messages = outputs
                        if not branch_messages:
                            break
                    results.extend(branch_messages)

            self._completed += 1
            return results
        except StageError:
            self._failed += 1
            raise
        except Exception:
            self._failed += 1
            self.ctx.logger.exception("Pipeline %s: unexpected error", self.name)
            raise

    def stats(self) -> dict[str, int]:
        return {
            "dispatched": self._dispatched,
            "completed": self._completed,
            "failed": self._failed,
            "in_flight": self._dispatched - self._completed - self._failed,
        }
