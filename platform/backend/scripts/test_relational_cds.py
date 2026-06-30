#!/usr/bin/env python3
"""
Local smoke test for the relational chart assembler + CDS Hooks card builders.

Runs entirely in-process — no DB, no network, no docker. Verifies the
DETERMINISTIC (no-LLM) core that powers the Relational view and the CDS
Hooks service:

  1. FHIR -> chart mapping (Patient/Condition/MedicationRequest/Allergy/
     Observation/Encounter/ServiceRequest)
  2. Link derivation: med.treats (reasonReference), lab.encounter_id
     (Observation.encounter), problem.med_ids back-refs, allergy_conflict
  3. Allergy<->drug cross-reactivity map (_derive_allergy_conflict)
  4. CDS patient-view cards: allergy_conflict (critical), untreated_problem,
     and patient-feedback cards ("patient voice", relational links)
  5. CDS order-select cards: drafted-med allergy check + relevant patient voice

Run from `backend/`:
    cd backend
    python3 scripts/test_relational_cds.py

Exit code is 0 on success, 1 on any failure.

Note: imports only `app.clinical.relational` and `app.cds.cards`, both of
which are pure-Python (no fastapi / sqlalchemy / pydantic at import time), so
this runs in the system Python without the container's dependencies.
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path
from types import SimpleNamespace

# Make `import app.*` work regardless of where this script is run.
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))

from app.clinical.relational import (  # noqa: E402
    build_chart_from_fhir,
    _derive_allergy_conflict,
)
from app.cds.cards import (  # noqa: E402
    build_patient_view_cards,
    build_order_select_cards,
)


# ── Tiny test runner (mirrors scripts/test_relay_local.py) ───────────────────

PASS = "[PASS]"
FAIL = "[FAIL]"
results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    print(f"  {status} {name}{(' — ' + detail) if detail else ''}")
    results.append((name, bool(condition), detail))
    return bool(condition)


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def _fb(**kw):
    """A stand-in PatientFeedback row (string enums are fine — the builders
    use getattr(x, 'value', x))."""
    kw.setdefault("status", "open")
    kw.setdefault("sentiment", "concern")
    kw.setdefault("topic", None)
    kw.setdefault("target_kind", None)
    kw.setdefault("target_ref", None)
    kw.setdefault("target_label", None)
    kw.setdefault("id", 1)
    return SimpleNamespace(**kw)


# A synthetic FHIR resource set with real relational references:
#   - amoxicillin (med m1) reasonReference -> hypertension? no: -> condition c1
#   - allergy a1 = Penicillin  => m1 (amoxicillin) should flag allergy_conflict
#   - observation o1 encounter -> e1
#   - condition c2 has no medication -> untreated problem
def _sample_resources() -> dict:
    return {
        "Patient": [{
            "resourceType": "Patient", "id": "p1",
            "name": [{"given": ["Alex"], "family": "Morgan"}],
            "gender": "male", "birthDate": "1985-06-15",
            "identifier": [{"value": "MRN-555"}],
        }],
        "Condition": [
            {"resourceType": "Condition", "id": "c1",
             "code": {"text": "Acute sinusitis"},
             "clinicalStatus": {"coding": [{"code": "active"}]},
             "onsetDateTime": "2026-01-10"},
            {"resourceType": "Condition", "id": "c2",
             "code": {"text": "Hyperlipidemia"},
             "clinicalStatus": {"coding": [{"code": "active"}]}},
        ],
        "MedicationRequest": [
            {"resourceType": "MedicationRequest", "id": "m1",
             "medicationCodeableConcept": {"text": "Amoxicillin 500mg"},
             "dosageInstruction": [{"text": "1 cap TID"}],
             "reasonReference": [{"reference": "Condition/c1"}]},
        ],
        "AllergyIntolerance": [
            {"resourceType": "AllergyIntolerance", "id": "a1",
             "code": {"text": "Penicillin"},
             "criticality": "high",
             "reaction": [{"manifestation": [{"text": "Hives"}]}]},
        ],
        "Observation": [
            {"resourceType": "Observation", "id": "o1",
             "code": {"text": "LDL Cholesterol"},
             "valueQuantity": {"value": 190, "unit": "mg/dL"},
             "interpretation": [{"coding": [{"code": "H"}]}],
             "effectiveDateTime": "2026-02-01",
             "encounter": {"reference": "Encounter/e1"}},
        ],
        "Encounter": [
            {"resourceType": "Encounter", "id": "e1",
             "type": [{"text": "Office visit"}],
             "period": {"start": "2026-02-01"},
             "reasonCode": [{"text": "Lipid follow-up"}]},
        ],
        "ServiceRequest": [
            {"resourceType": "ServiceRequest", "id": "s1",
             "code": {"text": "Cardiology"},
             "authoredOn": "2026-02-02",
             "reasonReference": [{"reference": "Condition/c2"}]},
        ],
    }


# ── 1. FHIR -> chart mapping ─────────────────────────────────────────────────

def test_fhir_mapping():
    section("1. FHIR -> chart mapping")
    chart = build_chart_from_fhir(_sample_resources(), source="test")
    d = chart["demographics"]
    check("patient name mapped", d["name"] == "Alex Morgan", d["name"])
    check("MRN from identifier", d["mrn"] == "MRN-555", d["mrn"])
    check("age computed from dob", d["age"] >= 40, str(d["age"]))
    check("2 problems", len(chart["problems"]) == 2)
    check("1 medication", len(chart["medications"]) == 1)
    check("med dose parsed", chart["medications"][0]["name"].startswith("Amoxicillin"))
    check("1 referral (ServiceRequest)", len(chart["referrals"]) == 1)
    check("lab flag H", chart["labs"][0]["flag"] == "H", chart["labs"][0]["flag"])


# ── 2. Link derivation ───────────────────────────────────────────────────────

def test_link_derivation():
    section("2. Link derivation")
    chart = build_chart_from_fhir(_sample_resources(), source="test")
    med = chart["medications"][0]
    check("med.treats -> condition c1", med["treats"] == "c1", med["treats"])
    c1 = next(p for p in chart["problems"] if p["id"] == "c1")
    check("problem.med_ids back-ref", med["id"] in c1["med_ids"], str(c1["med_ids"]))
    lab = chart["labs"][0]
    check("lab.encounter_id -> e1", lab["encounter_id"] == "e1", lab["encounter_id"])
    e1 = chart["encounters"][0]
    check("encounter.lab_ids back-ref", lab["id"] in e1["lab_ids"], str(e1["lab_ids"]))
    referral = chart["referrals"][0]
    check("referral.problem_id -> c2", referral["problem_id"] == "c2", referral["problem_id"])


# ── 3. Allergy cross-reactivity ──────────────────────────────────────────────

def test_allergy_conflict():
    section("3. Allergy <-> drug cross-reactivity")
    chart = build_chart_from_fhir(_sample_resources(), source="test")
    med = chart["medications"][0]
    check("amoxicillin flags penicillin allergy", med["allergy_conflict"] == "a1", med["allergy_conflict"])

    allergies = [{"id": "a1", "substance": "Penicillin", "reaction": "Hives", "severity": "severe"}]
    check("direct: penicillin->penicillin", _derive_allergy_conflict("Penicillin VK", allergies) == "a1")
    check("class: ampicillin->penicillin", _derive_allergy_conflict("Ampicillin", allergies) == "a1")
    check("no false positive: lisinopril", _derive_allergy_conflict("Lisinopril 10mg", allergies) == "")

    sulfa = [{"id": "a2", "substance": "Sulfa drugs", "reaction": "rash", "severity": "moderate"}]
    check("class: bactrim->sulfa", _derive_allergy_conflict("Bactrim DS", sulfa) == "a2")


# ── 4. CDS patient-view cards (incl. patient voice) ──────────────────────────

def test_patient_view_cards():
    section("4. CDS patient-view cards")
    chart = build_chart_from_fhir(_sample_resources(), source="test")
    feedback = [
        _fb(id=10, sentiment="preference", target_kind="medication", target_ref="m1",
            target_label="Amoxicillin 500mg", message="Prefer generic."),
        _fb(id=11, sentiment="question", message="Do I still need all my meds?"),
        _fb(id=12, sentiment="concern", status="resolved", message="resolved one, should be hidden"),
    ]
    cards = build_patient_view_cards(chart, feedback)
    kinds = [c["careos"]["kind"] for c in cards]

    check("allergy_conflict card present", "allergy_conflict" in kinds)
    crit = next(c for c in cards if c["careos"]["kind"] == "allergy_conflict")
    check("allergy card is critical", crit["indicator"] == "critical", crit["indicator"])
    check("allergy card links med+allergy", len(crit["careos"]["related"]) == 2)

    check("untreated_problem card present", "untreated_problem" in kinds)

    fb_cards = [c for c in cards if c["careos"]["kind"] == "patient_feedback"]
    check("2 open feedback cards (resolved hidden)", len(fb_cards) == 2, str(len(fb_cards)))
    check("preference feedback -> info", any(c["indicator"] == "info" for c in fb_cards))
    check("feedback card carries feedback_id", all(c["careos"]["feedback_id"] for c in fb_cards))
    pref = next((c for c in fb_cards if c["careos"]["feedback_id"] == 10), None)
    check("feedback card is relationally linked", bool(pref and pref["careos"]["related"]),
          str(pref["careos"]["related"]) if pref else "missing")
    check("feedback source = patient voice", any("Patient" in (c["source"]["label"]) for c in fb_cards))
    check("allergy card has a suggestion", bool(crit.get("suggestions")))
    check("preference feedback card has a suggestion", any(c.get("suggestions") for c in fb_cards))


# ── 5. CDS order-select cards ────────────────────────────────────────────────

def test_order_select_cards():
    section("5. CDS order-select cards")
    chart = build_chart_from_fhir(_sample_resources(), source="test")
    feedback = [
        _fb(id=20, sentiment="preference", target_kind="medication",
            target_label="Amoxicillin", message="Generic please."),
    ]
    # Drafting Amoxicillin for a penicillin-allergic patient must warn.
    cards = build_order_select_cards(chart, feedback, [{"id": "draft-1", "name": "Amoxicillin 500mg"}])
    kinds = [c["careos"]["kind"] for c in cards]
    check("order allergy_conflict critical", any(
        c["careos"]["kind"] == "allergy_conflict" and c["indicator"] == "critical" for c in cards))
    check("relevant patient voice surfaced on order", "patient_feedback" in kinds)

    # A safe drug with no matching allergy / feedback -> no cards.
    safe = build_order_select_cards(chart, [], [{"id": "draft-2", "name": "Lisinopril 10mg"}])
    check("safe order -> no cards", safe == [], str(len(safe)))


TESTS = [
    test_fhir_mapping,
    test_link_derivation,
    test_allergy_conflict,
    test_patient_view_cards,
    test_order_select_cards,
]


def main() -> int:
    print("CareOS relational + CDS — local smoke test")
    print(f"  python: {sys.version.split(chr(10))[0]}")
    fatal: list[tuple[str, str]] = []
    for fn in TESTS:
        try:
            fn()
        except Exception:
            fatal.append((fn.__name__, traceback.format_exc()))
            print(f"  {FAIL} {fn.__name__} raised:\n{traceback.format_exc()}")

    section("Summary")
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"  {passed} / {total} checks passed")
    if fatal:
        print(f"  {len(fatal)} test(s) raised exceptions")
    if passed == total and not fatal:
        print("\nAll checks passed.")
        return 0
    print("\nSome checks failed.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
