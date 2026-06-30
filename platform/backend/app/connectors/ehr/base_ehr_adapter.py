"""
Base EHR Adapter — defines the interface all vendor adapters must implement.

Handles SMART on FHIR discovery, OAuth 2.0 token exchange, and FHIR resource
access patterns common across Epic, Cerner, and MEDITECH.

All HTTP calls use httpx with proper timeouts and error handling.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

# Shared HTTP client settings
_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
_FHIR_HEADERS = {
    "Accept": "application/fhir+json, application/json",
    "User-Agent": "PatientHealthAgent/1.0 FHIR-Client",
}


@dataclass
class SmartConfig:
    """Parsed SMART on FHIR configuration from discovery."""
    authorization_endpoint: str = ""
    token_endpoint: str = ""
    introspection_endpoint: str = ""
    revocation_endpoint: str = ""
    scopes_supported: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    issuer: str = ""
    raw_json: dict = field(default_factory=dict)


@dataclass
class TokenResult:
    """Result of an OAuth token exchange or refresh."""
    success: bool
    access_token: str = ""
    refresh_token: str = ""
    expires_in: int = 0
    token_type: str = "Bearer"
    patient_id: str = ""
    scope: str = ""
    error: str = ""


class BaseEhrAdapter:
    """
    Abstract base for vendor-specific EHR adapters.

    Subclasses may override:
    - _discover_via_well_known()
    - _discover_via_capability()
    - _build_resource_url()
    - exchange_token()
    - refresh_access_token()
    - fetch_resource()
    - supported_resources()
    """
    vendor_name: str = "base"
    fhir_version: str = "R4"

    def __init__(self, fhir_base_url: str, client_id: str, client_secret: str = "",
                 redirect_uri: str = "", fhir_profile: str = "r4",
                 smart_discovery_mode: str = "smart_config"):
        self.fhir_base_url = fhir_base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.fhir_profile = fhir_profile
        self.smart_discovery_mode = smart_discovery_mode
        self._smart_config: Optional[SmartConfig] = None

    # ── HTTP helpers ─────────────────────────────────────────────────

    def _http_get(self, url: str, headers: dict | None = None,
                  params: dict | None = None) -> httpx.Response:
        """Synchronous GET with shared timeout and FHIR headers."""
        hdrs = {**_FHIR_HEADERS, **(headers or {})}
        return httpx.get(url, headers=hdrs, params=params, timeout=_TIMEOUT, follow_redirects=True)

    def _http_post(self, url: str, data: dict | None = None,
                   headers: dict | None = None) -> httpx.Response:
        """Synchronous POST for token endpoints."""
        hdrs = {**(headers or {})}
        return httpx.post(url, data=data, headers=hdrs, timeout=_TIMEOUT)

    # ── SMART Discovery ──────────────────────────────────────────────

    def discover_smart_config(self) -> SmartConfig:
        """
        Discover SMART on FHIR endpoints via live HTTP call.
        Prefers .well-known/smart-configuration; falls back to CapabilityStatement.
        """
        if self._smart_config:
            return self._smart_config

        if self.smart_discovery_mode == "smart_config":
            config = self._discover_via_well_known()
            if not config.authorization_endpoint:
                logger.warning("[%s] .well-known failed, falling back to CapabilityStatement", self.vendor_name)
                config = self._discover_via_capability()
        else:
            config = self._discover_via_capability()

        self._smart_config = config
        return config

    def _discover_via_well_known(self) -> SmartConfig:
        """GET {fhir_base_url}/.well-known/smart-configuration and parse."""
        url = f"{self.fhir_base_url}/.well-known/smart-configuration"
        logger.info("[%s] SMART discovery via %s", self.vendor_name, url)
        try:
            resp = self._http_get(url)
            resp.raise_for_status()
            data = resp.json()
            return SmartConfig(
                authorization_endpoint=data.get("authorization_endpoint", ""),
                token_endpoint=data.get("token_endpoint", ""),
                introspection_endpoint=data.get("introspection_endpoint", ""),
                revocation_endpoint=data.get("revocation_endpoint", ""),
                scopes_supported=data.get("scopes_supported", self._default_scopes()),
                capabilities=data.get("capabilities", []),
                issuer=data.get("issuer", self.fhir_base_url),
                raw_json=data,
            )
        except Exception as exc:
            logger.warning("[%s] .well-known/smart-configuration failed: %s", self.vendor_name, exc)
            return SmartConfig()

    def _discover_via_capability(self) -> SmartConfig:
        """GET {fhir_base_url}/metadata and extract SMART security extensions."""
        url = f"{self.fhir_base_url}/metadata"
        logger.info("[%s] SMART discovery via CapabilityStatement %s", self.vendor_name, url)
        try:
            resp = self._http_get(url)
            resp.raise_for_status()
            data = resp.json()
            return self._parse_capability_statement(data)
        except Exception as exc:
            logger.warning("[%s] CapabilityStatement fetch failed: %s", self.vendor_name, exc)
            return SmartConfig()

    def _parse_capability_statement(self, data: dict) -> SmartConfig:
        """Extract SMART OAuth endpoints from a FHIR CapabilityStatement."""
        auth_ep = ""
        token_ep = ""
        introspect_ep = ""
        revoke_ep = ""

        for rest in data.get("rest", []):
            security = rest.get("security", {})
            for ext in security.get("extension", []):
                if ext.get("url", "").endswith("oauth-uris"):
                    for sub in ext.get("extension", []):
                        url_val = sub.get("valueUri", sub.get("valueUrl", ""))
                        if sub.get("url") == "authorize":
                            auth_ep = url_val
                        elif sub.get("url") == "token":
                            token_ep = url_val
                        elif sub.get("url") == "introspect":
                            introspect_ep = url_val
                        elif sub.get("url") == "revoke":
                            revoke_ep = url_val

        return SmartConfig(
            authorization_endpoint=auth_ep,
            token_endpoint=token_ep,
            introspection_endpoint=introspect_ep,
            revocation_endpoint=revoke_ep,
            scopes_supported=self._default_scopes(),
            capabilities=[],
            issuer=data.get("implementation", {}).get("url", self.fhir_base_url),
            raw_json=data,
        )

    def _default_scopes(self) -> list[str]:
        """Override in subclasses for vendor-specific scope sets."""
        return ["openid", "profile", "launch", "online_access"]

    # ── OAuth 2.0 ────────────────────────────────────────────────────

    def authorize_url(self, scopes: list[str], state: str, launch: str = "",
                      code_challenge: str = "", redirect_uri: str = "") -> str:
        """Build the OAuth authorization redirect URL.

        Pass ``code_challenge`` (S256) to use PKCE — required for public
        clients per SMART on FHIR. ``redirect_uri`` overrides the adapter's
        configured redirect (so the OUTBOUND connect flow can land on CareOS's
        own callback endpoint).
        """
        config = self.discover_smart_config()
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri or self.redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
            "aud": self.fhir_base_url,
        }
        if launch:
            params["launch"] = launch
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
        return f"{config.authorization_endpoint}?{urlencode(params)}"

    def exchange_token(self, authorization_code: str, code_verifier: str = "",
                       redirect_uri: str = "") -> TokenResult:
        """Exchange authorization code for access token via real HTTP POST.

        Supply ``code_verifier`` to complete a PKCE flow.
        """
        config = self.discover_smart_config()
        if not config.token_endpoint:
            return TokenResult(success=False, error="No token endpoint discovered")

        logger.info("[%s] Token exchange at %s", self.vendor_name, config.token_endpoint)
        try:
            body = {
                "grant_type": "authorization_code",
                "code": authorization_code,
                "redirect_uri": redirect_uri or self.redirect_uri,
                "client_id": self.client_id,
            }
            if code_verifier:
                body["code_verifier"] = code_verifier
            if self.client_secret:
                body["client_secret"] = self.client_secret

            resp = self._http_post(
                config.token_endpoint,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()
            return TokenResult(
                success=True,
                access_token=data.get("access_token", ""),
                refresh_token=data.get("refresh_token", ""),
                expires_in=data.get("expires_in", 0),
                token_type=data.get("token_type", "Bearer"),
                patient_id=data.get("patient", ""),
                scope=data.get("scope", ""),
            )
        except Exception as exc:
            logger.error("[%s] Token exchange failed: %s", self.vendor_name, exc)
            return TokenResult(success=False, error=str(exc))

    def refresh_access_token(self, refresh_token: str) -> TokenResult:
        """Refresh an expired access token via real HTTP POST."""
        config = self.discover_smart_config()
        if not config.token_endpoint:
            return TokenResult(success=False, error="No token endpoint discovered")

        logger.info("[%s] Token refresh at %s", self.vendor_name, config.token_endpoint)
        try:
            body = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
            }
            if self.client_secret:
                body["client_secret"] = self.client_secret

            resp = self._http_post(
                config.token_endpoint,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()
            return TokenResult(
                success=True,
                access_token=data.get("access_token", ""),
                refresh_token=data.get("refresh_token", refresh_token),
                expires_in=data.get("expires_in", 0),
            )
        except Exception as exc:
            logger.error("[%s] Token refresh failed: %s", self.vendor_name, exc)
            return TokenResult(success=False, error=str(exc))

    # ── FHIR Resource Fetching ───────────────────────────────────────

    def _build_resource_url(self, resource_type: str, resource_id: str = "") -> str:
        """Build the FHIR resource URL. Override for vendor-specific paths."""
        url = f"{self.fhir_base_url}/{resource_type}"
        if resource_id:
            url += f"/{resource_id}"
        return url

    def fetch_resource(self, resource_type: str, resource_id: str = "",
                       params: dict | None = None, access_token: str = "") -> dict:
        """
        Fetch a FHIR resource via live HTTP GET.
        Uses Bearer token if provided; falls back to open endpoint.
        """
        url = self._build_resource_url(resource_type, resource_id)
        headers: dict[str, str] = {}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        logger.info("[%s] Fetching %s (params=%s)", self.vendor_name, url, params)
        try:
            resp = self._http_get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            data["_live"] = True
            data["_vendor"] = self.vendor_name
            data["_url"] = url
            return data
        except httpx.HTTPStatusError as exc:
            logger.error("[%s] HTTP %d from %s: %s",
                         self.vendor_name, exc.response.status_code, url,
                         exc.response.text[:300])
            return {
                "_live": True, "_error": True,
                "vendor": self.vendor_name,
                "resourceType": resource_type,
                "url": url,
                "status_code": exc.response.status_code,
                "error": exc.response.text[:500],
            }
        except Exception as exc:
            logger.error("[%s] Fetch failed for %s: %s", self.vendor_name, url, exc)
            return {
                "_live": True, "_error": True,
                "vendor": self.vendor_name,
                "resourceType": resource_type,
                "url": url,
                "error": str(exc),
            }

    def fetch_metadata(self) -> dict:
        """Fetch the FHIR CapabilityStatement (metadata) for this server."""
        url = f"{self.fhir_base_url}/metadata"
        logger.info("[%s] Fetching CapabilityStatement from %s", self.vendor_name, url)
        try:
            resp = self._http_get(url)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error("[%s] Metadata fetch failed: %s", self.vendor_name, exc)
            return {"error": str(exc)}

    def supported_resources(self) -> list[str]:
        """Return list of FHIR resource types this adapter can access."""
        return [
            "Patient", "Condition", "MedicationRequest", "AllergyIntolerance",
            "Observation", "Encounter", "Procedure", "Immunization",
            "DiagnosticReport", "DocumentReference",
        ]

    def introspect_token(self, token: str) -> dict:
        """Introspect a token for validation via live HTTP POST."""
        config = self.discover_smart_config()
        if not config.introspection_endpoint:
            return {"active": False, "error": "No introspection endpoint"}

        logger.info("[%s] Token introspection at %s", self.vendor_name, config.introspection_endpoint)
        try:
            resp = self._http_post(
                config.introspection_endpoint,
                data={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error("[%s] Introspection failed: %s", self.vendor_name, exc)
            return {"active": False, "error": str(exc)}
