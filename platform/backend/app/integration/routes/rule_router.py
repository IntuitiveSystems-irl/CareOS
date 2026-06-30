"""
Content-based routing.

A `RuleBasedRouter` evaluates a list of `(predicate, branch_name)` pairs
against each message; every matching predicate fans the message out to
that branch. A `default_branch` catches anything else.

A predicate is any `Callable[[PipelineMessage], bool]`. Examples:

    by_source("epic_backend_sandbox")
    by_hl7_message_type("ADT^A01")
    by_fhir_resource_type("Observation")

Use `single_branch("postgres")` if you don't need real routing logic yet —
it just labels every message for one downstream branch.
"""
from __future__ import annotations

from copy import copy
from typing import Callable, Iterable, Optional

from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    Route,
)


PredicateFn = Callable[[PipelineMessage], bool]


# ── Helpers ─────────────────────────────────────────────────────────────────

def by_source(source_id: str) -> PredicateFn:
    return lambda m: m.source_id == source_id


def by_hl7_message_type(msg_type: str) -> PredicateFn:
    """Match exactly ('ADT^A01') or by root type ('ADT')."""
    def pred(m: PipelineMessage) -> bool:
        full = m.metadata.get("hl7_message_type", "")
        return full == msg_type or full.startswith(msg_type + "^") or full == msg_type
    return pred


def by_fhir_resource_type(resource_type: str) -> PredicateFn:
    def pred(m: PipelineMessage) -> bool:
        body = m.body
        if not isinstance(body, dict):
            return False
        if body.get("resourceType") == resource_type:
            return True
        if body.get("resourceType") == "Bundle":
            for entry in body.get("entry", []):
                if isinstance(entry, dict) and isinstance(entry.get("resource"), dict):
                    if entry["resource"].get("resourceType") == resource_type:
                        return True
        return False
    return pred


def by_content_type(ct: str) -> PredicateFn:
    return lambda m: m.content_type == ct


# ── Routers ─────────────────────────────────────────────────────────────────

class RuleBasedRouter(Route):
    """Routes by evaluating a list of (predicate, branch) pairs."""

    name = "rule_router"

    def __init__(
        self,
        rules: Iterable[tuple[PredicateFn, str]],
        *,
        default_branch: Optional[str] = None,
        fan_out: bool = False,
    ):
        """
        Args:
          rules: ordered (predicate, branch) pairs.
          default_branch: branch to use if no rules match; if None,
            unmatched messages are dropped.
          fan_out: if True, a matching predicate doesn't stop evaluation —
            the message is cloned for every matching branch.
        """
        self.rules = list(rules)
        self.default_branch = default_branch
        self.fan_out = fan_out

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        matched_branches: list[str] = []
        for predicate, branch in self.rules:
            if predicate(message):
                matched_branches.append(branch)
                if not self.fan_out:
                    break

        if not matched_branches:
            if self.default_branch is None:
                ctx.logger.debug(
                    "Router %s: no branch matched message %s (source=%s, ct=%s)",
                    self.name, message.message_id, message.source_id, message.content_type,
                )
                return []
            matched_branches = [self.default_branch]

        out: list[PipelineMessage] = []
        for branch in matched_branches:
            m = copy(message)
            m.metadata = {**message.metadata, "route": branch}
            out.append(m)
        return out


def single_branch(branch_name: str) -> Route:
    """Convenience: tag every message for one branch (no real routing)."""
    return RuleBasedRouter([(lambda _m: True, branch_name)])
