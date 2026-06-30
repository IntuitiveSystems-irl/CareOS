"""
Relational chart assembler.

Turns either (a) live FHIR resources pulled through an EHR adapter or
(b) the internal canonical store into a single, link-derived "chart" payload
that the Relational and Standard (Traditional) clinician views both consume.

The whole point of CareOS's *relational* view is the cross-links between
records — "this med treats that problem", "this med conflicts with that
allergy", "this lab came from that encounter". FHIR carries some of these
as references (``reasonReference``, ``Observation.encounter``); the rest we
derive **deterministically** (no LLM): a small, auditable allergy↔drug
cross-reactivity map and date/keyword association for the internal store.

The output shape mirrors the frontend ``research`` ``Patient`` type:

    {
      "demographics": {name, mrn, sex, dob, age},
      "problems":    [{id, name, onset, status, med_ids[]}],
      "medications": [{id, name, dose, sig, treats, allergy_conflict}],
      "allergies":   [{id, substance, reaction, severity}],
      "encounters":  [{id, date, type, reason, provider, lab_ids[]}],
      "labs":        [{id, name, value, unit, date, flag, encounter_id}],
      "referrals":   [{id, date, specialty, provider, reason, problem_id}],
      "_source": "...",
    }
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional


# ── Deterministic allergy ↔ drug cross-reactivity map ────────────────────────
# Class name -> member substrings that imply membership in that class. Used to
# flag a medication as conflicting with a recorded allergy. Auditable & fixed.
CROSS_REACTIVITY: dict[str, list[str]] = {
    "penicillin": [
        "penicillin", "amoxicillin", "ampicillin", "augmentin",
        "dicloxacillin", "piperacillin", "amoxil",
    ],
    "cephalosporin": ["cephalexin", "cefazolin", "ceftriaxone", "cefdinir", "cefuroxime"],
    "sulfa": ["sulfamethoxazole", "bactrim", "sulfasalazine", "sulfa"],
    "nsaid": ["aspirin", "ibuprofen", "naproxen", "ketorolac", "diclofenac", "asa"],
    "opioid": ["codeine", "morphine", "hydrocodone", "oxycodone", "hydromorphone"],
    "statin": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
}

# Internal-store only: medication keyword -> condition keyword(s) it treats.
MED_TREATS_KEYWORDS: dict[str, list[str]] = {
    "metformin": ["diabetes", "dm", "glucose"],
    "insulin": ["diabetes", "dm"],
    "glipizide": ["diabetes", "dm"],
    "lisinopril": ["hypertension", "htn", "blood pressure"],
    "amlodipine": ["hypertension", "htn", "blood pressure"],
    "losartan": ["hypertension", "htn", "blood pressure"],
    "hydrochlorothiazide": ["hypertension", "htn"],
    "atorvastatin": ["hyperlipidemia", "cholesterol", "lipid"],
    "simvastatin": ["hyperlipidemia", "cholesterol", "lipid"],
    "albuterol": ["asthma", "copd", "reactive airway"],
    "levothyroxine": ["hypothyroid", "thyroid"],
    "sertraline": ["depression", "anxiety", "mdd"],
    "fluoxetine": ["depression", "anxiety"],
    "omeprazole": ["reflux", "gerd", "ulcer"],
    "gabapentin": ["neuropathy", "pain", "seizure"],
    "warfarin": ["atrial fibrillation", "afib", "thrombosis", "clot"],
}


# ── small helpers ─────────────────────────────────────────────────────────────

def _ref_id(ref: Any) -> str:
    """Extract the logical id from a FHIR reference string or {'reference': ...}."""
    if isinstance(ref, dict):
        ref = ref.get("reference", "")
    if not ref:
        return ""
    ref = str(ref)
    if "/" in ref:
        return ref.rsplit("/", 1)[-1]
    if ":" in ref:
        return ref.rsplit(":", 1)[-1]
    return ref


def _cc_text(cc: Any) -> str:
    """Human label from a FHIR CodeableConcept (or list of them)."""
    if isinstance(cc, list):
        for item in cc:
            t = _cc_text(item)
            if t:
                return t
        return ""
    if not isinstance(cc, dict):
        return str(cc) if cc else ""
    if cc.get("text"):
        return cc["text"]
    for c in cc.get("coding", []):
        if c.get("display"):
            return c["display"]
        if c.get("code"):
            return c["code"]
    return ""


def _date_str(value: Any) -> str:
    if not value:
        return ""
    s = str(value)
    return s[:10]  # YYYY-MM-DD


def _age_from_dob(dob: str) -> int:
    if not dob:
        return 0
    try:
        d = datetime.strptime(dob[:10], "%Y-%m-%d").date()
    except ValueError:
        return 0
    today = date.today()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


def _derive_allergy_conflict(med_name: str, allergies: list[dict]) -> str:
    """Return the id of a conflicting allergy for this med name, or ''."""
    n = (med_name or "").lower()
    if not n:
        return ""
    for a in allergies:
        sub = (a.get("substance") or "").lower()
        if not sub:
            continue
        token = sub.split()[0]
        if len(token) >= 4 and token in n:
            return a["id"]
        for members in CROSS_REACTIVITY.values():
            allergy_in_class = any(m in sub for m in members)
            med_in_class = any(m in n for m in members)
            if allergy_in_class and med_in_class:
                return a["id"]
    return ""


# ── FHIR resource mappers ─────────────────────────────────────────────────────

def _map_demographics(res: dict) -> dict:
    name = ""
    names = res.get("name") or []
    if names:
        n0 = names[0]
        if n0.get("text"):
            name = n0["text"]
        else:
            given = " ".join(n0.get("given", []) or [])
            name = f"{given} {n0.get('family', '')}".strip()
    mrn = ""
    for ident in res.get("identifier", []) or []:
        if ident.get("value"):
            mrn = ident["value"]
            break
    if not mrn:
        mrn = res.get("id", "") or ""
    dob = res.get("birthDate", "") or ""
    return {
        "name": name or "Unknown Patient",
        "mrn": mrn,
        "sex": res.get("gender", "unknown") or "unknown",
        "dob": dob,
        "age": _age_from_dob(dob),
    }


def _map_condition(res: dict) -> dict:
    return {
        "id": res.get("id", "") or "",
        "name": _cc_text(res.get("code")) or "Condition",
        "onset": _date_str(res.get("onsetDateTime") or res.get("recordedDate")),
        "status": _cc_text(res.get("clinicalStatus")) or "active",
        "med_ids": [],
    }


def _map_medication(res: dict) -> dict:
    name = _cc_text(res.get("medicationCodeableConcept"))
    if not name and isinstance(res.get("medicationReference"), dict):
        name = res["medicationReference"].get("display", "")
    dose = ""
    sig = ""
    di = res.get("dosageInstruction") or []
    if di:
        sig = di[0].get("text", "") or ""
        dq = (di[0].get("doseAndRate") or [{}])[0].get("doseQuantity") or {}
        if dq:
            dose = f"{dq.get('value', '')}{dq.get('unit', '')}".strip()
    treats = ""
    for rr in res.get("reasonReference", []) or []:
        treats = _ref_id(rr)
        if treats:
            break
    return {
        "id": res.get("id", "") or "",
        "name": name or "Medication",
        "dose": dose,
        "sig": sig,
        "treats": treats,
        "allergy_conflict": "",
    }


def _map_allergy(res: dict) -> dict:
    reaction = ""
    rx = res.get("reaction") or []
    if rx:
        manifestations = rx[0].get("manifestation") or []
        if manifestations:
            reaction = _cc_text(manifestations[0])
    crit = (res.get("criticality") or "").lower()
    severity = "severe" if crit == "high" else ("moderate" if crit == "low" else "moderate")
    return {
        "id": res.get("id", "") or "",
        "substance": _cc_text(res.get("code")) or "Allergen",
        "reaction": reaction or "unknown",
        "severity": severity,
    }


def _map_encounter(res: dict) -> dict:
    period = res.get("period") or {}
    enc_type = _cc_text(res.get("type"))
    if not enc_type:
        cls = res.get("class") or {}
        enc_type = cls.get("display") or cls.get("code") or "encounter"
    provider = ""
    for part in res.get("participant", []) or []:
        ind = part.get("individual") or {}
        if ind.get("display"):
            provider = ind["display"]
            break
    return {
        "id": res.get("id", "") or "",
        "date": _date_str(period.get("start")),
        "type": enc_type,
        "reason": _cc_text(res.get("reasonCode")) or enc_type,
        "provider": provider,
        "lab_ids": [],
    }


def _map_observation(res: dict) -> dict:
    vq = res.get("valueQuantity") or {}
    value = vq.get("value", "")
    unit = vq.get("unit", "") or ""
    if value == "" and res.get("valueString"):
        value = res["valueString"]
    flag = ""
    for interp in res.get("interpretation", []) or []:
        code = _cc_text(interp).upper()
        if "HIGH" in code or code == "H":
            flag = "H"
        elif "LOW" in code or code == "L":
            flag = "L"
    return {
        "id": res.get("id", "") or "",
        "name": _cc_text(res.get("code")) or "Observation",
        "value": str(value),
        "unit": unit,
        "date": _date_str(res.get("effectiveDateTime") or res.get("issued")),
        "flag": flag,
        "encounter_id": _ref_id(res.get("encounter")),
    }


def _map_servicerequest(res: dict) -> dict:
    requester = (res.get("requester") or {}).get("display", "")
    problem_id = ""
    for rr in res.get("reasonReference", []) or []:
        problem_id = _ref_id(rr)
        if problem_id:
            break
    return {
        "id": res.get("id", "") or "",
        "date": _date_str(res.get("authoredOn")),
        "specialty": _cc_text(res.get("code")) or "Referral",
        "provider": requester,
        "reason": _cc_text(res.get("reasonCode")),
        "problem_id": problem_id,
    }


def bundle_resources(payload: Any) -> list[dict]:
    """Return resource dicts from a FHIR Bundle, a single resource, or [] on error."""
    if not isinstance(payload, dict):
        return []
    if payload.get("_error"):
        return []
    if payload.get("resourceType") == "Bundle":
        out = []
        for entry in payload.get("entry", []) or []:
            res = entry.get("resource") if isinstance(entry, dict) else None
            if isinstance(res, dict) and res.get("resourceType"):
                out.append(res)
        return out
    if payload.get("resourceType"):
        return [payload]
    return []


def build_chart_from_fhir(resources: dict[str, list[dict]], source: str = "fhir") -> dict:
    """Assemble + link a chart from already-extracted FHIR resource lists."""
    patient_list = resources.get("Patient") or []
    demographics = _map_demographics(patient_list[0] if patient_list else {})

    problems = [_map_condition(c) for c in resources.get("Condition", [])]
    allergies = [_map_allergy(a) for a in resources.get("AllergyIntolerance", [])]
    encounters = [_map_encounter(e) for e in resources.get("Encounter", [])]
    labs = [_map_observation(o) for o in resources.get("Observation", [])]
    medications = [_map_medication(m) for m in resources.get("MedicationRequest", [])]
    referrals = [_map_servicerequest(s) for s in resources.get("ServiceRequest", [])]

    _derive_links(problems, medications, allergies, encounters, labs)

    return {
        "demographics": demographics,
        "problems": problems,
        "medications": medications,
        "allergies": allergies,
        "encounters": encounters,
        "labs": labs,
        "referrals": referrals,
        "_source": source,
    }


def _derive_links(problems, medications, allergies, encounters, labs) -> None:
    """Fill allergy_conflict + back-references (problem.med_ids, encounter.lab_ids)."""
    for m in medications:
        m["allergy_conflict"] = _derive_allergy_conflict(m["name"], allergies)
    prob_ids = {p["id"] for p in problems}
    for m in medications:
        if m["treats"] and m["treats"] not in prob_ids:
            m["treats"] = ""  # dangling reference — drop it
    for p in problems:
        p["med_ids"] = [m["id"] for m in medications if m["treats"] == p["id"]]
    enc_ids = {e["id"] for e in encounters}
    for l in labs:
        if l["encounter_id"] and l["encounter_id"] not in enc_ids:
            l["encounter_id"] = ""
    for e in encounters:
        e["lab_ids"] = [l["id"] for l in labs if l["encounter_id"] == e["id"]]


# ── live fetch (through an EHR adapter) ───────────────────────────────────────

_LIVE_TYPES = [
    "Condition", "MedicationRequest", "AllergyIntolerance",
    "Observation", "Encounter", "ServiceRequest",
]


def fetch_live_chart(adapter, patient_id: str, access_token: str = "") -> dict:
    """Pull a patient's record from a live FHIR server and assemble the chart."""
    resources: dict[str, list[dict]] = {}

    pat = adapter.fetch_resource("Patient", resource_id=patient_id, access_token=access_token)
    resources["Patient"] = bundle_resources(pat)

    for rt in _LIVE_TYPES:
        payload = adapter.fetch_resource(
            rt,
            params={"patient": patient_id, "_count": 50},
            access_token=access_token,
        )
        resources[rt] = bundle_resources(payload)

    return build_chart_from_fhir(resources, source=f"live:{adapter.vendor_name}")


# ── internal canonical store ──────────────────────────────────────────────────

def _internal_treats(med_name: str, problems: list[dict]) -> str:
    n = (med_name or "").lower()
    for key, cond_keywords in MED_TREATS_KEYWORDS.items():
        if key in n:
            for p in problems:
                pn = p["name"].lower()
                if any(kw in pn for kw in cond_keywords):
                    return p["id"]
    return ""


def build_chart_from_internal(db, patient_id: int) -> Optional[dict]:
    """Assemble a chart from the internal demo/canonical store."""
    from app.models import (
        Patient, Diagnosis, Medication, Allergy, LabResult, Encounter,
    )

    p = db.query(Patient).get(patient_id)
    if not p:
        return None

    dob = p.date_of_birth.isoformat() if p.date_of_birth else ""
    demographics = {
        "name": f"{p.first_name} {p.last_name}".strip(),
        "mrn": str(p.id),
        "sex": p.gender or "unknown",
        "dob": dob,
        "age": _age_from_dob(dob),
    }

    problems = [
        {
            "id": f"c{d.id}",
            "name": d.description or (d.code or "Condition"),
            "onset": d.date_diagnosed.isoformat() if d.date_diagnosed else "",
            "status": d.status or "active",
            "med_ids": [],
        }
        for d in db.query(Diagnosis).filter(Diagnosis.patient_id == patient_id).all()
    ]

    allergies = [
        {
            "id": f"a{a.id}",
            "substance": a.allergen or "Allergen",
            "reaction": a.reaction or "unknown",
            "severity": (a.severity.value if a.severity else "moderate"),
        }
        for a in db.query(Allergy).filter(Allergy.patient_id == patient_id).all()
    ]

    encounters = [
        {
            "id": f"e{e.id}",
            "date": e.date.date().isoformat() if e.date else "",
            "type": e.type or "encounter",
            "reason": e.summary or e.type or "visit",
            "provider": e.provider or "",
            "lab_ids": [],
        }
        for e in db.query(Encounter).filter(Encounter.patient_id == patient_id).all()
    ]

    labs = [
        {
            "id": f"l{l.id}",
            "name": l.test_name or "Lab",
            "value": str(l.value) if l.value is not None else "",
            "unit": l.unit or "",
            "date": l.date.date().isoformat() if l.date else "",
            "flag": "H" if (l.status and "high" in l.status.lower()) else "",
            "encounter_id": "",
        }
        for l in db.query(LabResult).filter(LabResult.patient_id == patient_id).all()
    ]

    medications = []
    for m in db.query(Medication).filter(Medication.patient_id == patient_id).all():
        medications.append({
            "id": f"m{m.id}",
            "name": m.name or "Medication",
            "dose": m.dosage or "",
            "sig": m.frequency or "",
            "treats": _internal_treats(m.name or "", problems),
            "allergy_conflict": "",
        })

    # Internal store has no Observation.encounter — associate labs to encounters
    # on the same calendar date (deterministic).
    enc_by_date = {e["date"]: e["id"] for e in encounters if e["date"]}
    for l in labs:
        if l["date"] in enc_by_date:
            l["encounter_id"] = enc_by_date[l["date"]]

    _derive_links(problems, medications, allergies, encounters, labs)

    return {
        "demographics": demographics,
        "problems": problems,
        "medications": medications,
        "allergies": allergies,
        "encounters": encounters,
        "labs": labs,
        "referrals": [],
        "_source": "internal",
    }
