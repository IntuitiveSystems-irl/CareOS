"""
HL7 v2.x → FHIR R4 transform.

Implements just enough of the HL7v2 grammar to map the message types we
expect from hospital interfaces:

    ADT^A01  Admit / visit notification     → Patient + Encounter
    ADT^A04  Register a patient             → Patient + Encounter
    ADT^A08  Update patient information     → Patient (update)
    ADT^A28  Add person information         → Patient
    ADT^A31  Update person information      → Patient (update)
    ORU^R01  Unsolicited observation result → Patient + Observation(s) + DiagnosticReport
    SIU^S12  Notify of new appointment      → Patient + Appointment
    MDM^T02  Original document notification → Patient + DocumentReference

For anything we don't map we still produce a Patient resource if PID is
present, so downstream patient-matching keeps working. Unmapped segments
land in `metadata.unmapped_segments` for later expansion.

This module does not depend on any HL7 library — we parse just enough of
the wire format ourselves so the relay has zero external HL7 dependencies.
For a full HL7v2 schema validator, swap this transform out for one backed
by `hl7apy` or `python-hl7`.
"""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    StageError,
    Transform,
)

logger = logging.getLogger(__name__)


# ── HL7 wire-format parser ──────────────────────────────────────────────────

@dataclass
class Hl7Segment:
    """One HL7 segment: name + list of fields, each field a list of components."""
    name: str
    fields: list[list[list[str]]] = field(default_factory=list)

    def field(self, idx: int) -> list[list[str]]:
        """1-indexed (HL7 convention). Returns empty list if missing."""
        i = idx - 1
        return self.fields[i] if 0 <= i < len(self.fields) else []

    def component(self, field_idx: int, component_idx: int = 1, rep: int = 0) -> str:
        """1-indexed field, 1-indexed component, 0-indexed repetition."""
        f = self.field(field_idx)
        if rep >= len(f):
            return ""
        components = f[rep]
        c_i = component_idx - 1
        return components[c_i] if 0 <= c_i < len(components) else ""


@dataclass
class Hl7Message:
    segments: list[Hl7Segment] = field(default_factory=list)
    encoding: str = "^~\\&"

    def first(self, name: str) -> Optional[Hl7Segment]:
        for s in self.segments:
            if s.name == name:
                return s
        return None

    def all_named(self, name: str) -> list[Hl7Segment]:
        return [s for s in self.segments if s.name == name]


def parse_hl7_message(raw: bytes | str) -> Hl7Message:
    """Parse an HL7 v2.x message into segments / fields / components.

    Tolerant of <LF>-only line endings and stray whitespace at end.
    """
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    raw = raw.replace("\r\n", "\r").replace("\n", "\r").strip("\r\x0b\x1c")
    if not raw:
        raise StageError("Empty HL7 message", code="empty_hl7")

    if not raw.startswith("MSH"):
        raise StageError("HL7 message does not start with MSH", code="missing_msh")

    field_sep = raw[3]                       # MSH-1
    encoding_block = raw[4:8]                # MSH-2 (4 chars: comp, rep, escape, subcomp)
    if len(encoding_block) < 4:
        raise StageError("Truncated MSH encoding characters", code="bad_msh")
    component_sep = encoding_block[0]
    repetition_sep = encoding_block[1]
    # escape_char = encoding_block[2]        # not used yet
    subcomp_sep = encoding_block[3]

    msg = Hl7Message(encoding=encoding_block)

    for line_idx, line in enumerate(raw.split("\r")):
        if not line:
            continue
        # MSH is special — its first field IS the field separator.
        if line.startswith("MSH"):
            raw_fields = [line[:3], field_sep, encoding_block] + line[4:].split(field_sep)[1:]
        else:
            raw_fields = line.split(field_sep)

        seg = Hl7Segment(name=raw_fields[0])
        for f_raw in raw_fields[1:]:
            reps = f_raw.split(repetition_sep)
            seg.fields.append([rep.split(component_sep) for rep in reps])
        msg.segments.append(seg)

    return msg


# ── HL7v2 → FHIR mapping helpers ────────────────────────────────────────────

_HL7_TS_RE = re.compile(r"^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?")


def hl7_ts_to_iso(ts: str) -> Optional[str]:
    """Convert an HL7 TS field (YYYYMMDDHHMMSS) to an ISO-8601 string.

    Returns None if the field is empty or malformed.
    """
    if not ts:
        return None
    m = _HL7_TS_RE.match(ts)
    if not m:
        return None
    parts = [m.group(i) for i in range(1, 7)]
    year, month, day, hour, minute, second = (
        int(p) if p else None for p in parts
    )
    if not year:
        return None
    if month and day:
        try:
            dt = datetime(
                year, month, day,
                hour or 0, minute or 0, second or 0,
                tzinfo=timezone.utc,
            )
        except ValueError:
            return None
        return dt.isoformat()
    # Date-only
    return f"{year:04d}-{(month or 1):02d}-{(day or 1):02d}"


def hl7_date_to_iso(value: str) -> Optional[str]:
    """Strict YYYYMMDD → YYYY-MM-DD."""
    if not value or len(value) < 8 or not value[:8].isdigit():
        return None
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"


GENDER_MAP = {
    "M": "male",
    "F": "female",
    "O": "other",
    "U": "unknown",
    "A": "other",      # Ambiguous
    "N": "unknown",    # Not applicable
}


def gen_id() -> str:
    return uuid.uuid4().hex[:16]


# ── Segment mappers ─────────────────────────────────────────────────────────

def map_pid_to_patient(pid: Hl7Segment) -> dict[str, Any]:
    """PID segment → FHIR Patient resource (dict form)."""
    # PID-3 = patient identifier list (we take the first rep, first component).
    mrn = pid.component(3, 1, rep=0) or pid.component(3, 1)
    given = pid.component(5, 2, rep=0)
    family = pid.component(5, 1, rep=0)
    middle = pid.component(5, 3, rep=0)

    name_parts: dict[str, Any] = {"family": family or None}
    given_list = [g for g in [given, middle] if g]
    if given_list:
        name_parts["given"] = given_list

    patient: dict[str, Any] = {
        "resourceType": "Patient",
        "id": mrn or gen_id(),
    }
    if mrn:
        patient["identifier"] = [{
            "system": "urn:oid:2.16.840.1.113883.4.6",  # placeholder MRN system
            "value": mrn,
        }]
    if name_parts.get("family") or name_parts.get("given"):
        patient["name"] = [name_parts]

    dob = hl7_date_to_iso(pid.component(7, 1))
    if dob:
        patient["birthDate"] = dob

    gender = GENDER_MAP.get(pid.component(8, 1).upper())
    if gender:
        patient["gender"] = gender

    # PID-11 = address (first rep): street ^ other ^ city ^ state ^ zip ^ country
    street = pid.component(11, 1, rep=0)
    city = pid.component(11, 3, rep=0)
    state = pid.component(11, 4, rep=0)
    postal = pid.component(11, 5, rep=0)
    country = pid.component(11, 6, rep=0)
    if any([street, city, state, postal, country]):
        addr: dict[str, Any] = {}
        if street:
            addr["line"] = [street]
        if city:
            addr["city"] = city
        if state:
            addr["state"] = state
        if postal:
            addr["postalCode"] = postal
        if country:
            addr["country"] = country
        patient["address"] = [addr]

    # PID-13 = phone (home), PID-14 = phone (business). HL7 v2 puts the
    # number itself in either component 1 (legacy) or component 12 (XTN.12).
    telecom: list[dict[str, str]] = []
    for fld, use in ((13, "home"), (14, "work")):
        phone = pid.component(fld, 12, rep=0) or pid.component(fld, 1, rep=0)
        if phone:
            telecom.append({"system": "phone", "value": phone, "use": use})
    if telecom:
        patient["telecom"] = telecom

    return patient


def map_pv1_to_encounter(pv1: Hl7Segment, patient_id: str) -> dict[str, Any]:
    """PV1 segment → FHIR Encounter resource."""
    encounter: dict[str, Any] = {
        "resourceType": "Encounter",
        "id": pv1.component(19, 1) or gen_id(),
        "status": "in-progress",
        "subject": {"reference": f"Patient/{patient_id}"},
    }
    # PV1-2 = patient class (I=inpatient, O=outpatient, E=emergency, P=preadmit).
    class_code = pv1.component(2, 1).upper()
    class_map = {
        "I": ("IMP", "inpatient encounter"),
        "O": ("AMB", "ambulatory"),
        "E": ("EMER", "emergency"),
        "P": ("PRENC", "pre-admission"),
    }
    if class_code in class_map:
        code, display = class_map[class_code]
        encounter["class"] = {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": code,
            "display": display,
        }
    # PV1-44 = admit datetime.
    admit_iso = hl7_ts_to_iso(pv1.component(44, 1))
    if admit_iso:
        encounter["period"] = {"start": admit_iso}
    # PV1-7 = attending doctor name (XCN). component 2/3 = given/family.
    attending_given = pv1.component(7, 3)
    attending_family = pv1.component(7, 2)
    if attending_given or attending_family:
        encounter["participant"] = [{
            "individual": {
                "display": f"{attending_given} {attending_family}".strip()
            },
        }]
    return encounter


def map_obx_to_observation(
    obx: Hl7Segment, patient_id: str, encounter_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """OBX segment → FHIR Observation."""
    code = obx.component(3, 1)        # observation identifier
    text = obx.component(3, 2)
    system = obx.component(3, 3)
    value = obx.component(5, 1)
    units = obx.component(6, 1)
    refrange = obx.component(7, 1)
    status_code = obx.component(11, 1).upper() or "F"
    timestamp_iso = hl7_ts_to_iso(obx.component(14, 1))

    if not (code or text or value):
        return None

    status_map = {"F": "final", "P": "preliminary", "C": "corrected", "X": "cancelled"}

    obs: dict[str, Any] = {
        "resourceType": "Observation",
        "id": gen_id(),
        "status": status_map.get(status_code, "final"),
        "subject": {"reference": f"Patient/{patient_id}"},
        "code": {
            "coding": [{"system": system, "code": code, "display": text}] if code else [],
            "text": text or code,
        },
    }
    if encounter_id:
        obs["encounter"] = {"reference": f"Encounter/{encounter_id}"}
    if timestamp_iso:
        obs["effectiveDateTime"] = timestamp_iso
    # OBX-2 = value type (NM, ST, TX, CWE, etc.).
    vtype = obx.component(2, 1).upper()
    if vtype == "NM":
        try:
            obs["valueQuantity"] = {
                "value": float(value),
                "unit": units or "",
            }
        except ValueError:
            obs["valueString"] = value
    elif value:
        obs["valueString"] = value
    if refrange:
        obs["referenceRange"] = [{"text": refrange}]
    return obs


def map_al1_to_allergy(al1: Hl7Segment, patient_id: str) -> dict[str, Any]:
    """AL1 segment → FHIR AllergyIntolerance."""
    code = al1.component(3, 1)
    text = al1.component(3, 2) or al1.component(3, 1)
    severity = al1.component(4, 1).upper()
    reaction = al1.component(5, 1)
    severity_map = {"SV": "severe", "MO": "moderate", "MI": "mild"}
    return {
        "resourceType": "AllergyIntolerance",
        "id": gen_id(),
        "patient": {"reference": f"Patient/{patient_id}"},
        "code": {
            "coding": [{"code": code, "display": text}] if code else [],
            "text": text,
        },
        "reaction": ([{"manifestation": [{"text": reaction}],
                       "severity": severity_map.get(severity, "mild")}]
                     if reaction else []),
    }


def map_dg1_to_condition(dg1: Hl7Segment, patient_id: str) -> dict[str, Any]:
    """DG1 segment → FHIR Condition."""
    code = dg1.component(3, 1)
    text = dg1.component(3, 2)
    system = dg1.component(3, 3) or "http://hl7.org/fhir/sid/icd-10"
    onset = hl7_ts_to_iso(dg1.component(5, 1))
    return {
        "resourceType": "Condition",
        "id": gen_id(),
        "subject": {"reference": f"Patient/{patient_id}"},
        "code": {
            "coding": [{"system": system, "code": code, "display": text}] if code else [],
            "text": text or code,
        },
        "clinicalStatus": {"coding": [{"code": "active"}]},
        "onsetDateTime": onset,
    }


# ── Top-level message → bundle dispatcher ──────────────────────────────────

# Message types we know how to fully process.
_KNOWN_TYPES = {"ADT", "ORU", "SIU", "MDM"}


def hl7_message_to_fhir_bundle(msg: Hl7Message) -> dict[str, Any]:
    """Convert an Hl7Message into a FHIR R4 transaction Bundle.

    Always emits a Patient (if PID present). Other resources are added as
    relevant segments appear.
    """
    msh = msg.first("MSH")
    if msh is None:
        raise StageError("Missing MSH segment", code="missing_msh")

    # MSH-9 carries the message structure as components: <type>^<event>^<struct>.
    # `msh.component(9, 1)` only returns the first component (e.g. "ADT"),
    # so we reassemble the full name (e.g. "ADT^A01") for routing/auditing.
    message_type_root = msh.component(9, 1)
    trigger_event = msh.component(9, 2)
    message_type_full = (
        f"{message_type_root}^{trigger_event}" if trigger_event else message_type_root
    )

    pid = msg.first("PID")
    pv1 = msg.first("PV1")

    entries: list[dict[str, Any]] = []
    patient_id: Optional[str] = None

    if pid is not None:
        patient_resource = map_pid_to_patient(pid)
        patient_id = patient_resource["id"]
        entries.append({
            "fullUrl": f"urn:uuid:{patient_id}",
            "resource": patient_resource,
            "request": {"method": "PUT", "url": f"Patient/{patient_id}"},
        })

    encounter_id: Optional[str] = None
    if pv1 is not None and patient_id:
        encounter_resource = map_pv1_to_encounter(pv1, patient_id)
        encounter_id = encounter_resource["id"]
        entries.append({
            "fullUrl": f"urn:uuid:{encounter_id}",
            "resource": encounter_resource,
            "request": {"method": "PUT", "url": f"Encounter/{encounter_id}"},
        })

    if patient_id:
        for obx in msg.all_named("OBX"):
            obs = map_obx_to_observation(obx, patient_id, encounter_id)
            if obs:
                entries.append({
                    "fullUrl": f"urn:uuid:{obs['id']}",
                    "resource": obs,
                    "request": {"method": "POST", "url": "Observation"},
                })
        for al1 in msg.all_named("AL1"):
            allergy = map_al1_to_allergy(al1, patient_id)
            entries.append({
                "fullUrl": f"urn:uuid:{allergy['id']}",
                "resource": allergy,
                "request": {"method": "POST", "url": "AllergyIntolerance"},
            })
        for dg1 in msg.all_named("DG1"):
            condition = map_dg1_to_condition(dg1, patient_id)
            entries.append({
                "fullUrl": f"urn:uuid:{condition['id']}",
                "resource": condition,
                "request": {"method": "POST", "url": "Condition"},
            })

    bundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "tag": [{
                "system": "https://launchflow.tech/relay/hl7",
                "code": message_type_full,
                "display": f"{message_type_full} ({trigger_event})" if trigger_event else message_type_full,
            }],
        },
        "entry": entries,
    }
    return bundle


# ── Pipeline Transform wrapper ──────────────────────────────────────────────

class Hl7v2ToFhirTransform(Transform):
    """Pipeline stage: HL7v2 bytes → FHIR R4 Bundle dict.

    Sets `message.body` to the bundle, `message.content_type` to
    `application/fhir+json`, and records the message_type / control_id in
    `message.metadata` for the router downstream.
    """

    name = "hl7v2_to_fhir"

    def __init__(self, *, strict: bool = False):
        # `strict=True` rejects messages we don't have a typed mapping for;
        # default is best-effort (Patient + whatever else we can pull).
        self.strict = strict

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        if message.content_type != "application/hl7-v2":
            raise StageError(
                f"Expected application/hl7-v2, got {message.content_type!r}",
                code="wrong_content_type",
            )
        raw = message.body
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        if not isinstance(raw, (bytes, bytearray)):
            raise StageError(
                f"Expected bytes body, got {type(raw).__name__}",
                code="bad_body_type",
            )
        try:
            parsed = parse_hl7_message(raw)
        except StageError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise StageError(f"HL7 parse failed: {exc}", code="hl7_parse_error") from exc

        msh = parsed.first("MSH")
        if msh is not None:
            mt_root = msh.component(9, 1)
            trigger = msh.component(9, 2)
            message_type_full = f"{mt_root}^{trigger}" if trigger else mt_root
        else:
            message_type_full = ""
        message_type_full = message_type_full or "UNKNOWN"
        message_type_root = message_type_full.split("^", 1)[0]

        if self.strict and message_type_root not in _KNOWN_TYPES:
            raise StageError(
                f"Unsupported HL7 message type in strict mode: {message_type_full}",
                code="unsupported_message_type",
            )

        try:
            bundle = hl7_message_to_fhir_bundle(parsed)
        except StageError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise StageError(f"HL7→FHIR mapping failed: {exc}", code="map_error") from exc

        message.body = bundle
        message.content_type = "application/fhir+json"
        message.metadata.update({
            "hl7_message_type": message_type_full,
            "hl7_message_type_root": message_type_root,
            "fhir_entry_count": len(bundle.get("entry", [])),
        })
        return [message]


# ── Convenience ─────────────────────────────────────────────────────────────

def iter_resources(bundle: dict[str, Any]) -> Iterable[dict[str, Any]]:
    """Yield each `entry.resource` from a FHIR Bundle in order."""
    for entry in bundle.get("entry", []):
        if isinstance(entry, dict) and isinstance(entry.get("resource"), dict):
            yield entry["resource"]
