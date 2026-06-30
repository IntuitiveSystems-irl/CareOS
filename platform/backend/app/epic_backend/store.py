"""
File-backed persistence for FHIR Bundle responses pulled via Epic Backend
Services. Writes one file per connection at .data/fhir-{connection_id}.json.

Kept intentionally separate from the SQLAlchemy AccessToken/AccessRequest
schema — these Backend Services flows are server-to-server admin fetches
and don't represent a patient consent record. They can be promoted into the
DB later if needed.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional

DATA_DIR = Path.cwd() / ".data"

# connection IDs are alphanumeric + underscore + hyphen only.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]+$")


@dataclass
class FhirData:
    connection_id: str
    adapter_id: str
    fetched_at: str
    patient: Optional[dict[str, Any]] = None
    conditions: Optional[dict[str, Any]] = None
    medications: Optional[dict[str, Any]] = None
    allergies: Optional[dict[str, Any]] = None
    labs: Optional[dict[str, Any]] = None
    encounters: Optional[dict[str, Any]] = None
    procedures: Optional[dict[str, Any]] = None
    immunizations: Optional[dict[str, Any]] = None
    documents: Optional[dict[str, Any]] = None
    errors: Optional[dict[str, str]] = field(default=None)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _is_safe_id(connection_id: str) -> bool:
    return bool(_SAFE_ID.match(connection_id))


def save_fhir_data(data: FhirData) -> None:
    """Persist a FhirData record to .data/fhir-{connection_id}.json."""
    if not _is_safe_id(data.connection_id):
        raise ValueError(f"Unsafe connection_id: {data.connection_id!r}")
    _ensure_dir()
    target = DATA_DIR / f"fhir-{data.connection_id}.json"
    target.write_text(json.dumps(data.to_dict(), indent=2, default=str), encoding="utf-8")


def load_fhir_data(connection_id: str) -> Optional[dict[str, Any]]:
    """Return the persisted FhirData payload as a plain dict, or None."""
    if not _is_safe_id(connection_id):
        return None
    target = DATA_DIR / f"fhir-{connection_id}.json"
    if not target.exists():
        return None
    try:
        return json.loads(target.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def list_connection_ids() -> list[str]:
    """List connection_ids that have a persisted FHIR data file."""
    _ensure_dir()
    out: list[str] = []
    for path in DATA_DIR.iterdir():
        name = path.name
        if name.startswith("fhir-") and name.endswith(".json"):
            out.append(name[len("fhir-") : -len(".json")])
    return sorted(out)


def count_bundle_entries(bundle: Optional[dict[str, Any]]) -> int:
    """Helper for API summaries — counts entries in a FHIR searchset bundle."""
    if not isinstance(bundle, dict):
        return 0
    entries = bundle.get("entry")
    return len(entries) if isinstance(entries, list) else 0
