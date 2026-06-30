"""
Epic hospital directory — parsed from open.epic.com/Endpoints/R4 FHIR Bundle.

Each entry has {id, name, fhirBase}. Used by the signup / connect flow's
hospital picker for autocomplete and to drive per-hospital SMART discovery.

Refresh by re-parsing open.epic.com's FHIR Bundle and overwriting hospitals.json.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

_DATA_FILE = Path(__file__).with_name("hospitals.json")


@dataclass(frozen=True)
class EpicHospital:
    id: str
    name: str
    fhir_base: str


def _load() -> list[EpicHospital]:
    if not _DATA_FILE.exists():
        return []
    try:
        raw = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(raw, list):
        return []
    out: list[EpicHospital] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        hid = entry.get("id")
        name = entry.get("name")
        fhir = entry.get("fhirBase") or entry.get("fhir_base")
        if not (hid and name and fhir):
            continue
        out.append(EpicHospital(id=hid, name=name, fhir_base=fhir))
    return out


EPIC_HOSPITALS: list[EpicHospital] = _load()


def search_hospitals(query: str, limit: int = 25) -> list[EpicHospital]:
    """Case-insensitive substring search over hospital names."""
    q = (query or "").strip().lower()
    if not q:
        return EPIC_HOSPITALS[:limit]
    out: list[EpicHospital] = []
    for h in EPIC_HOSPITALS:
        if q in h.name.lower():
            out.append(h)
            if len(out) >= limit:
                break
    return out


def find_hospital_by_id(hospital_id: str) -> Optional[EpicHospital]:
    for h in EPIC_HOSPITALS:
        if h.id == hospital_id:
            return h
    return None


def to_dicts(hospitals: Iterable[EpicHospital]) -> list[dict[str, str]]:
    """Return JSON-serializable dicts matching the source schema (camelCase)."""
    return [{"id": h.id, "name": h.name, "fhirBase": h.fhir_base} for h in hospitals]
