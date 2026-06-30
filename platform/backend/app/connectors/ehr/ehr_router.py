"""
EHR Adapter Router — selects the correct vendor adapter based on organization config.

Usage:
    from app.connectors.ehr import get_adapter_for_org
    adapter = get_adapter_for_org(organization)
    config = adapter.discover_smart_config()
    result = adapter.fetch_resource("Patient", patient_id, access_token=token)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Organization

from app.connectors.ehr.base_ehr_adapter import BaseEhrAdapter
from app.connectors.ehr.epic_adapter import EpicAdapter
from app.connectors.ehr.cerner_adapter import CernerAdapter
from app.connectors.ehr.meditech_adapter import MeditechAdapter

logger = logging.getLogger(__name__)

_ADAPTER_MAP: dict[str, type[BaseEhrAdapter]] = {
    "epic": EpicAdapter,
    "cerner": CernerAdapter,
    "meditech": MeditechAdapter,
}


def get_adapter_for_org(org: "Organization") -> BaseEhrAdapter:
    """
    Create and return the appropriate EHR adapter for the given organization.

    Falls back to BaseEhrAdapter if vendor is unknown or not set.
    """
    vendor = getattr(org, "ehr_vendor", None)
    vendor_key = vendor.value if vendor else "other"

    adapter_cls = _ADAPTER_MAP.get(vendor_key, BaseEhrAdapter)

    adapter = adapter_cls(
        fhir_base_url=org.fhir_base_url or "",
        client_id=org.client_id or "",
        client_secret=org.client_secret or "",
        redirect_uri=org.redirect_uri or "",
        fhir_profile=getattr(org, "fhir_profile", "r4") or "r4",
        smart_discovery_mode=getattr(org, "smart_discovery_mode", "smart_config") or "smart_config",
    )

    logger.info(
        "Resolved EHR adapter: %s for org=%s (vendor=%s)",
        adapter_cls.__name__, org.name, vendor_key,
    )
    return adapter
