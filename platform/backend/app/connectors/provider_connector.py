"""
Provider Office Connector Stub — simulates sending referral packets to specialist offices.
In production, this would integrate with Direct messaging or a real referral management system.
"""
import logging

from app.connectors.base import BaseConnector, SendResult

logger = logging.getLogger(__name__)


class ProviderOfficeConnectorStub(BaseConnector):
    name = "provider_stub"

    def send(self, task_type: str, destination_name: str, payload: dict) -> SendResult:
        specialty = payload.get("specialty", "specialist")
        logger.info(
            "[ProviderOfficeConnectorStub] Sent referral packet to '%s' (%s)",
            destination_name,
            specialty,
        )
        return SendResult(
            success=True,
            status="sent",
            external_reference_id=f"REF-STUB-{specialty[:8].upper()}",
            message=f"Referral packet sent to {destination_name} (stub). Office scheduled.",
        )
