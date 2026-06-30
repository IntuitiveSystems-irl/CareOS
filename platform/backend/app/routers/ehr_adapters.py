"""
EHR Adapter API routes — expose vendor adapter info, SMART discovery,
and live FHIR resource fetching through vendor-specific adapters.

All adapters now make real HTTP calls to Epic, Cerner, and MEDITECH
FHIR endpoints (sandbox/open endpoints for demo).
"""
import time
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization
from app.schemas import EhrAdapterInfoOut
from app.connectors.ehr.ehr_router import get_adapter_for_org
from app.routers.ehr_connect import get_active_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ehr-adapters", tags=["ehr-adapters"])


@router.get("/org/{org_id}/info", response_model=EhrAdapterInfoOut)
def get_adapter_info(org_id: int, db: Session = Depends(get_db)):
    """Return EHR adapter info and live SMART discovery config for an organization."""
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)
    config = adapter.discover_smart_config()

    return EhrAdapterInfoOut(
        org_id=org.id,
        org_name=org.name,
        ehr_vendor=org.ehr_vendor.value if org.ehr_vendor else None,
        fhir_base_url=org.fhir_base_url,
        fhir_profile=org.fhir_profile,
        smart_discovery_mode=org.smart_discovery_mode,
        authorization_endpoint=config.authorization_endpoint,
        token_endpoint=config.token_endpoint,
        introspection_endpoint=config.introspection_endpoint,
        scopes_supported=config.scopes_supported,
        capabilities=config.capabilities,
        supported_resources=adapter.supported_resources(),
    )


@router.get("/org/{org_id}/resources")
def get_supported_resources(org_id: int, db: Session = Depends(get_db)):
    """Return list of FHIR resources supported by this org's EHR vendor."""
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)
    return {
        "org_id": org.id,
        "ehr_vendor": org.ehr_vendor.value if org.ehr_vendor else "other",
        "resources": adapter.supported_resources(),
    }


@router.post("/org/{org_id}/fetch/{resource_type}")
def fetch_resource_via_adapter(
    org_id: int, resource_type: str,
    resource_id: str = "", patient: str = "", count: int = 0,
    db: Session = Depends(get_db),
):
    """
    Fetch a FHIR resource through the org's vendor adapter (live HTTP).
    Pass ``patient`` to search by patient context, ``count`` to page results.
    Uses a stored OAuth token when connected; otherwise the open endpoint.
    """
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)

    # Use a stored OAuth token if this org has been connected; otherwise fall
    # back to the open/sandbox endpoint (read-only).
    tok = get_active_token(db, org_id)
    access_token = tok.access_token if tok else ""

    params: dict = {}
    if patient:
        params["patient"] = patient
    if count:
        params["_count"] = count

    result = adapter.fetch_resource(
        resource_type=resource_type,
        resource_id=resource_id,
        params=params or None,
        access_token=access_token,
    )
    if isinstance(result, dict):
        result["_authorized"] = bool(access_token)
    return result


@router.get("/org/{org_id}/smart-config")
def get_smart_config(org_id: int, db: Session = Depends(get_db)):
    """Return the live-discovered SMART on FHIR configuration for an org."""
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)
    config = adapter.discover_smart_config()
    return {
        "issuer": config.issuer,
        "authorization_endpoint": config.authorization_endpoint,
        "token_endpoint": config.token_endpoint,
        "introspection_endpoint": config.introspection_endpoint,
        "revocation_endpoint": config.revocation_endpoint,
        "scopes_supported": config.scopes_supported,
        "capabilities": config.capabilities,
    }


@router.get("/org/{org_id}/metadata")
def get_fhir_metadata(org_id: int, db: Session = Depends(get_db)):
    """Fetch the live FHIR CapabilityStatement (metadata) from the vendor's server."""
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)
    return adapter.fetch_metadata()


@router.get("/connectivity-test")
def test_all_connections(db: Session = Depends(get_db)):
    """
    Test connectivity to all configured EHR vendor FHIR endpoints.
    For each organization, attempts:
    1. SMART on FHIR discovery (or CapabilityStatement)
    2. /metadata endpoint fetch
    Returns per-vendor results with latency and status.
    """
    orgs = db.query(Organization).all()
    results = []

    for org in orgs:
        vendor = org.ehr_vendor.value if org.ehr_vendor else "unknown"
        entry = {
            "org_id": org.id,
            "org_name": org.name,
            "ehr_vendor": vendor,
            "fhir_base_url": org.fhir_base_url,
            "smart_discovery": {"status": "untested"},
            "metadata": {"status": "untested"},
        }

        adapter = get_adapter_for_org(org)

        # Test 1: SMART discovery
        t0 = time.time()
        try:
            config = adapter.discover_smart_config()
            latency = round((time.time() - t0) * 1000)
            has_auth = bool(config.authorization_endpoint)
            has_token = bool(config.token_endpoint)
            entry["smart_discovery"] = {
                "status": "connected" if (has_auth or has_token) else "partial",
                "latency_ms": latency,
                "authorization_endpoint": config.authorization_endpoint or None,
                "token_endpoint": config.token_endpoint or None,
                "scopes_supported_count": len(config.scopes_supported),
                "capabilities_count": len(config.capabilities),
            }
        except Exception as exc:
            latency = round((time.time() - t0) * 1000)
            entry["smart_discovery"] = {
                "status": "failed",
                "latency_ms": latency,
                "error": str(exc),
            }

        # Test 2: /metadata (CapabilityStatement)
        t0 = time.time()
        try:
            meta = adapter.fetch_metadata()
            latency = round((time.time() - t0) * 1000)
            is_error = "error" in meta and not meta.get("resourceType")
            resource_type = meta.get("resourceType", "")
            fhir_ver = meta.get("fhirVersion", "")
            entry["metadata"] = {
                "status": "connected" if resource_type == "CapabilityStatement" else (
                    "failed" if is_error else "partial"
                ),
                "latency_ms": latency,
                "resourceType": resource_type,
                "fhirVersion": fhir_ver,
                "software": meta.get("software", {}).get("name", "") if isinstance(meta.get("software"), dict) else "",
            }
            if is_error:
                entry["metadata"]["error"] = str(meta.get("error", ""))[:200]
        except Exception as exc:
            latency = round((time.time() - t0) * 1000)
            entry["metadata"] = {
                "status": "failed",
                "latency_ms": latency,
                "error": str(exc),
            }

        # Overall status
        smart_ok = entry["smart_discovery"]["status"] in ("connected", "partial")
        meta_ok = entry["metadata"]["status"] in ("connected", "partial")
        entry["overall"] = "connected" if (smart_ok or meta_ok) else "failed"

        results.append(entry)

    connected_count = sum(1 for r in results if r["overall"] == "connected")
    return {
        "total_orgs": len(results),
        "connected": connected_count,
        "failed": len(results) - connected_count,
        "results": results,
    }
