"""
Deterministic CDS Hooks card builders (no LLM).

Cards are derived from the relational chart (the same link-derived structure
the clinician's Relational view renders) plus the patient's own feedback
(the Patient Fishbowl voice). Every card carries a CareOS ``careos`` extension
that names the *related* chart entities, so the clinician UI can render the
card in **relational style** — i.e. showing what links to what, and surfacing
what the patient said about it.

Card shape follows the HL7 CDS Hooks spec
(https://cds-hooks.org/specification/current/#card-attributes) with an extra
``careos`` object that standard EHR consumers simply ignore.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from app.clinical.relational import _derive_allergy_conflict

CARE_SOURCE = {"label": "CareOS", "url": "https://launchflow.tech"}
PATIENT_SOURCE = {"label": "Patient (via CareOS Patient Fishbowl)"}

# How a patient's stated sentiment maps onto a CDS indicator.
_SENTIMENT_INDICATOR = {
    "concern": "warning",
    "decline": "warning",
    "preference": "info",
    "question": "info",
    "agree": "info",
}

_SENTIMENT_VERB = {
    "concern": "is concerned about",
    "decline": "is declining",
    "preference": "has a preference about",
    "question": "has a question about",
    "agree": "agrees with",
}


def _suggestions(labels: Optional[list[str]]) -> list[dict]:
    """Build CDS Hooks suggestion objects (advisory; no write-back actions)."""
    return [{"uuid": str(uuid.uuid4()), "label": lbl} for lbl in (labels or []) if lbl]


def _card(
    *, summary: str, indicator: str, detail: str,
    source: dict, kind: str,
    related: Optional[list[dict]] = None,
    feedback_id: Optional[int] = None,
    suggestions: Optional[list[str]] = None,
) -> dict:
    card = {
        "uuid": str(uuid.uuid4()),
        "summary": summary[:140],
        "indicator": indicator,
        "detail": detail,
        "source": source,
        "careos": {
            "kind": kind,
            "related": related or [],
            "feedback_id": feedback_id,
        },
    }
    sugg = _suggestions(suggestions)
    if sugg:
        card["suggestions"] = sugg
    return card


# Deterministic suggestion text per patient-feedback sentiment.
_SENTIMENT_SUGGESTION = {
    "preference": "Honor the patient's stated preference where clinically appropriate",
    "decline": "Discuss alternatives and document informed refusal",
    "concern": "Acknowledge and address the patient's concern at the visit",
    "question": "Answer the patient's question at the next encounter",
}


# ── chart-derived (relational) cards ─────────────────────────────────────────

def _allergy_conflict_cards(chart: dict) -> list[dict]:
    cards: list[dict] = []
    allergies = {a["id"]: a for a in chart.get("allergies", [])}
    for m in chart.get("medications", []):
        aid = m.get("allergy_conflict")
        if not aid or aid not in allergies:
            continue
        a = allergies[aid]
        cards.append(_card(
            summary=f"Allergy conflict: {m['name']} vs {a['substance']} allergy",
            indicator="critical",
            detail=(
                f"**{m['name']}** may conflict with a documented allergy to "
                f"**{a['substance']}** (reaction: {a.get('reaction', 'unknown')}, "
                f"severity: {a.get('severity', 'unknown')}). Review before continuing."
            ),
            source=CARE_SOURCE,
            kind="allergy_conflict",
            related=[
                {"kind": "medication", "id": m["id"], "label": m["name"]},
                {"kind": "allergy", "id": a["id"], "label": a["substance"]},
            ],
            suggestions=[f"Choose an alternative to {m['name']}"],
        ))
    return cards


def _untreated_problem_cards(chart: dict) -> list[dict]:
    cards: list[dict] = []
    for p in chart.get("problems", []):
        status = (p.get("status") or "").lower()
        if status and status not in ("active", "confirmed", ""):
            continue
        if not p.get("med_ids"):
            cards.append(_card(
                summary=f"No active medication linked to: {p['name']}",
                indicator="info",
                detail=(
                    f"The problem **{p['name']}** has no linked medication in the "
                    f"chart. Confirm this is intentional or consider treatment."
                ),
                source=CARE_SOURCE,
                kind="untreated_problem",
                related=[{"kind": "problem", "id": p["id"], "label": p["name"]}],
                suggestions=[f"Consider treatment or document rationale for {p['name']}"],
            ))
    return cards


# ── patient-feedback (the patient's voice) cards ─────────────────────────────

def _feedback_card(fb: Any, chart: Optional[dict] = None) -> dict:
    """Turn one PatientFeedback row into a relational CDS card."""
    sentiment = getattr(fb.sentiment, "value", fb.sentiment) or "concern"
    indicator = _SENTIMENT_INDICATOR.get(sentiment, "info")
    verb = _SENTIMENT_VERB.get(sentiment, "noted")
    target_label = fb.target_label or fb.topic or "their care"

    related: list[dict] = []
    if fb.target_kind and fb.target_ref:
        related.append({
            "kind": fb.target_kind,
            "id": fb.target_ref,
            "label": fb.target_label or fb.target_ref,
        })

    detail = (
        f"> {fb.message}\n\n"
        f"*Patient {verb} **{target_label}***"
    )
    if related:
        detail += "\n\nLinked record: " + ", ".join(
            f"{r['kind']} · {r['label']}" for r in related
        )

    suggestion = _SENTIMENT_SUGGESTION.get(sentiment)
    return _card(
        summary=f"Patient feedback: {verb} {target_label}",
        indicator=indicator,
        detail=detail,
        source=PATIENT_SOURCE,
        kind="patient_feedback",
        related=related,
        feedback_id=fb.id,
        suggestions=[suggestion] if suggestion else None,
    )


def build_patient_view_cards(chart: dict, feedback: list[Any]) -> list[dict]:
    """patient-view hook: chart-derived safety + the patient's open feedback."""
    cards: list[dict] = []
    cards.extend(_allergy_conflict_cards(chart))
    cards.extend(_untreated_problem_cards(chart))
    for fb in feedback:
        status = getattr(fb.status, "value", fb.status)
        if status == "resolved":
            continue
        cards.append(_feedback_card(fb, chart))
    return cards


def build_order_select_cards(
    chart: dict,
    feedback: list[Any],
    draft_meds: list[dict],
) -> list[dict]:
    """order-select / order-sign hook: check drafted meds + relevant patient voice.

    ``draft_meds`` is a list of {"name": str, "id": str} extracted from the
    CDS Hooks ``context.draftOrders`` / ``selections``.
    """
    cards: list[dict] = []
    allergies = chart.get("allergies", [])

    for med in draft_meds:
        name = med.get("name", "")
        if not name:
            continue
        aid = _derive_allergy_conflict(name, allergies)
        if aid:
            a = next((x for x in allergies if x["id"] == aid), None)
            if a:
                cards.append(_card(
                    summary=f"Allergy conflict on order: {name} vs {a['substance']}",
                    indicator="critical",
                    detail=(
                        f"The ordered medication **{name}** may conflict with a "
                        f"documented allergy to **{a['substance']}** "
                        f"(reaction: {a.get('reaction', 'unknown')}). Consider an alternative."
                    ),
                    source=CARE_SOURCE,
                    kind="allergy_conflict",
                    related=[
                        {"kind": "order", "id": med.get("id", name), "label": name},
                        {"kind": "allergy", "id": a["id"], "label": a["substance"]},
                    ],
                    suggestions=[
                        f"Remove {name} from the order",
                        f"Select an alternative not cross-reactive with {a['substance']}",
                    ],
                ))

        # Surface patient feedback relevant to this drug (relational match).
        low = name.lower()
        for fb in feedback:
            status = getattr(fb.status, "value", fb.status)
            if status == "resolved":
                continue
            label = (fb.target_label or "").lower()
            kind = (fb.target_kind or "")
            if kind in ("medication", "order") and label and (
                label in low or low in label
            ):
                cards.append(_feedback_card(fb, chart))

    return cards
