"""
Base connector interface for fulfillment routing.
All stub (and future real) connectors implement this interface.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SendResult:
    """Result returned by a connector after attempting to send a task."""
    success: bool
    status: str  # sent, acknowledged, failed, needs_patient_input
    external_reference_id: Optional[str] = None
    message: str = ""


class BaseConnector:
    """
    Abstract base for fulfillment connectors.
    Subclasses must implement send().
    """
    name: str = "base"

    def send(self, task_type: str, destination_name: str, payload: dict) -> SendResult:
        raise NotImplementedError("Subclasses must implement send()")
