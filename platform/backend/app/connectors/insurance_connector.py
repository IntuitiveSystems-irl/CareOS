"""
Insurance Connector Stub — simulates generating and submitting insurance/prior-auth packets.
In production, this would integrate with X12 278/275 or a payer API.
"""
import logging

from app.connectors.base import BaseConnector, SendResult

logger = logging.getLogger(__name__)


class InsuranceConnectorStub(BaseConnector):
    name = "insurance_stub"

    def send(self, task_type: str, destination_name: str, payload: dict) -> SendResult:
        procedure = payload.get("procedure", "unspecified procedure")
        logger.info(
            "[InsuranceConnectorStub] Generated insurance packet and submitted to '%s' for %s",
            destination_name,
            procedure,
        )
        return SendResult(
            success=True,
            status="sent",
            external_reference_id=f"AUTH-STUB-{procedure[:8].upper()}",
            message=f"Insurance/prior-auth packet submitted to {destination_name} (stub). Prior auth pending.",
        )
