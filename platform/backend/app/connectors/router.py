"""
Task Router — selects the appropriate connector based on task destination_type
and dispatches the send call. Returns the SendResult.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.connectors.base import SendResult
from app.connectors.lab_connector import LabConnectorStub
from app.connectors.pharmacy_connector import PharmacyConnectorStub
from app.connectors.provider_connector import ProviderOfficeConnectorStub
from app.connectors.insurance_connector import InsuranceConnectorStub

if TYPE_CHECKING:
    from app.models import FulfillmentTask

logger = logging.getLogger(__name__)

_CONNECTORS = {
    "lab": LabConnectorStub(),
    "pharmacy": PharmacyConnectorStub(),
    "provider": ProviderOfficeConnectorStub(),
    "payer": InsuranceConnectorStub(),
}


def route_task(task: "FulfillmentTask") -> SendResult:
    """Route a FulfillmentTask to the appropriate connector stub."""
    dest_type = task.destination_type.value if hasattr(task.destination_type, "value") else str(task.destination_type)
    connector = _CONNECTORS.get(dest_type)

    if connector is None:
        logger.warning("[TaskRouter] No connector for destination_type=%s", dest_type)
        return SendResult(
            success=False,
            status="failed",
            message=f"No connector registered for destination type '{dest_type}'",
        )

    destination_name = task.destination.name if task.destination else f"Destination #{task.destination_id}"
    payload = task.payload_json or {}
    task_type = task.type.value if hasattr(task.type, "value") else str(task.type)

    try:
        result = connector.send(task_type, destination_name, payload)
    except Exception as exc:
        logger.exception("[TaskRouter] Connector error for task %s", task.id)
        result = SendResult(success=False, status="failed", message=str(exc))

    return result
