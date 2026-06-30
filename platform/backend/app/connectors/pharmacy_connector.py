"""
Pharmacy Connector Stub — simulates routing prescriptions to a pharmacy.
Does NOT modify prescriptions (immutability rule). Only routes the request.
In production, this would integrate with NCPDP SCRIPT / Surescripts.
"""
import logging

from app.connectors.base import BaseConnector, SendResult

logger = logging.getLogger(__name__)


class PharmacyConnectorStub(BaseConnector):
    name = "pharmacy_stub"

    def send(self, task_type: str, destination_name: str, payload: dict) -> SendResult:
        med_name = payload.get("medication_name", "unknown medication")
        logger.info(
            "[PharmacyConnectorStub] Sent prescription routing request to '%s': %s",
            destination_name,
            med_name,
        )
        return SendResult(
            success=True,
            status="sent",
            external_reference_id=f"RX-STUB-{med_name[:8].upper()}",
            message=f"Prescription routing request sent to {destination_name} (stub). Pharmacy received.",
        )
