"""
Lab Connector Stub — simulates sending lab orders to a laboratory.
In production, this would integrate with a real LIS (Lab Information System).
"""
import logging

from app.connectors.base import BaseConnector, SendResult

logger = logging.getLogger(__name__)


class LabConnectorStub(BaseConnector):
    name = "lab_stub"

    def send(self, task_type: str, destination_name: str, payload: dict) -> SendResult:
        logger.info(
            "[LabConnectorStub] Sent lab order to '%s': %s",
            destination_name,
            payload.get("test_name", "unknown test"),
        )
        return SendResult(
            success=True,
            status="sent",
            external_reference_id=f"LAB-STUB-{payload.get('test_name', 'X')[:8].upper()}",
            message=f"Lab order sent to {destination_name} (stub). Acknowledgement simulated.",
        )
