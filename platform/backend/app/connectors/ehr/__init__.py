"""
EHR Vendor Adapter Framework.

Provides vendor-specific adapters for Epic, Cerner, and MEDITECH EHR systems.
Each adapter implements the BaseEhrAdapter interface for SMART on FHIR discovery,
OAuth token handling, and FHIR resource access.

These are structured stubs for demo — real integrations replace the simulated
HTTP calls with actual vendor API calls.
"""
from app.connectors.ehr.base_ehr_adapter import BaseEhrAdapter, SmartConfig, TokenResult
from app.connectors.ehr.ehr_router import get_adapter_for_org

__all__ = ["BaseEhrAdapter", "SmartConfig", "TokenResult", "get_adapter_for_org"]
