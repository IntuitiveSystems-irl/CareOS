"""
CareOS Global Data Pool — public analytics API.

All data here is de-identified aggregate. No PHI returned anywhere.

Endpoints:
  GET /pool/summary          Total contributions, participants, clinics, regions
  GET /pool/trends           Time-series contribution counts (weekly)
  GET /pool/conditions       Top condition codes contributing globally
  GET /pool/medications      Top medication codes
  GET /pool/allergies        Top allergy codes
  GET /pool/regions          Contributions by region (scoreboard)
  GET /pool/research         Research authorization rates + cohort sizes
  GET /pool/live             Live feed — last N contributions (no PHI)
  GET /pool/cds-signals      Aggregated signals for CDS (care gaps, anomalies)
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PoolContribution, CheckInSession, CheckInStatus

router = APIRouter(prefix="/pool", tags=["data-pool"])


# ── Seed demo data if pool is empty ──────────────────────────────────────────

DEMO_CONDITIONS = [
    ["J06.9", "J30.1", "Z87.891"],   # URI, allergic rhinitis, tobacco
    ["I10", "E11.9", "Z79.4"],        # HTN, T2DM, insulin
    ["M54.5", "F32.9"],               # low back, depression
    ["J45.909", "Z88.0"],             # asthma, penicillin allergy
    ["E78.5", "I10", "Z82.49"],       # hyperlipidemia, HTN, family CVD
    ["K21.0", "F41.1"],               # GERD, anxiety
    ["N39.0", "E11.9"],               # UTI, T2DM
    ["J18.9", "J06.9"],               # pneumonia, URI
]
DEMO_MEDS = [
    ["857001", "723"],                # metformin, amoxicillin
    ["197361", "308460"],             # lisinopril, atorvastatin
    ["7052", "5640"],                 # albuterol, sertraline
    ["41493", "1049"],                # omeprazole, ibuprofen
]
DEMO_ALLERGIES = [
    ["372687004", "764146007"],       # penicillin, sulfa
    ["387458008"],                    # aspirin
    ["372687004", "7980"],            # penicillin, shellfish
]
DEMO_REGIONS = [
    "CA-US", "CA-US", "NY-US", "TX-US", "WA-US",
    "FL-US", "IL-US", "UK", "CA-CA", "AU",
    "NY-US", "TX-US", "CA-US", "WA-US", "CO-US",
]
DEMO_AGES = ["18-24", "25-34", "25-34", "35-44", "35-44", "45-54", "55-64", "65+"]

DEMO_HEADLINES = [
    ("Respiratory", "Seasonal upper respiratory cluster — penicillin allergy flagged across cohort"),
    ("Cardiology", "Hypertension + T2DM comorbidity pattern — ACE inhibitor use confirmed"),
    ("Primary Care", "Medication list discrepancy resolved — statin adherence gap identified"),
    ("Allergy/Immunology", "Sulfonamide allergy reported across 3 patients in same region"),
    ("Endocrinology", "Insulin initiation cohort — patient-reported outcomes collected"),
    ("Pulmonology", "Asthma exacerbation cluster — albuterol rescue use elevated"),
    ("Gastroenterology", "GERD + anxiety comorbidity — PPI adherence verified"),
    ("Infectious Disease", "Community UTI cluster — antibiotic sensitivity pattern noted"),
]


def _ensure_demo_data(db: Session):
    count = db.query(PoolContribution).count()
    if count >= 50:
        return
    import random
    rng = random.Random(42)
    now = datetime.utcnow()
    for i in range(50 - count):
        days_ago = rng.randint(0, 90)
        ts = now - timedelta(days=days_ago)
        week = f"{ts.year}-W{ts.isocalendar()[1]:02d}"
        validated = rng.random() > 0.35
        category, headline = rng.choice(DEMO_HEADLINES)
        db.add(PoolContribution(
            session_id=1,
            region=rng.choice(DEMO_REGIONS),
            clinic_name=rng.choice(["SLO Family Clinic", "Pacific Health", "Metro Medical", "HealthFirst", "Bay Clinic"]),
            resource_types=rng.choice([
                ["name_dob_phone", "insurance", "medications", "allergies", "research_authorization"],
                ["name_dob_phone", "conditions", "recent_labs", "research_authorization"],
                ["name_dob_phone", "insurance", "medications", "conditions"],
            ]),
            condition_codes=rng.choice(DEMO_CONDITIONS),
            medication_codes=rng.choice(DEMO_MEDS),
            allergy_codes=rng.choice(DEMO_ALLERGIES),
            research_authorized=rng.random() > 0.2,
            age_bucket=rng.choice(DEMO_AGES),
            sex=rng.choice(["M", "F", "U"]),
            contributed_at=ts,
            week_bucket=week,
            clinician_validated=validated,
            validated_by="Dr. Demo MD" if validated else None,
            validated_at=ts if validated else None,
            headline=headline if validated else None,
            category=category if validated else None,
        ))
    db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _code_label(code: str) -> str:
    LABELS = {
        "J06.9": "Upper Respiratory Infection", "J30.1": "Allergic Rhinitis",
        "I10": "Hypertension", "E11.9": "Type 2 Diabetes", "M54.5": "Low Back Pain",
        "F32.9": "Depression", "J45.909": "Asthma", "E78.5": "Hyperlipidemia",
        "K21.0": "GERD", "F41.1": "Anxiety", "N39.0": "UTI", "J18.9": "Pneumonia",
        "Z87.891": "Tobacco Use (History)", "Z88.0": "Penicillin Allergy",
        "Z79.4": "Insulin Use", "Z82.49": "Family Hx Cardiovascular",
        "857001": "Metformin", "723": "Amoxicillin", "197361": "Lisinopril",
        "308460": "Atorvastatin", "7052": "Albuterol", "5640": "Sertraline",
        "41493": "Omeprazole", "1049": "Ibuprofen",
        "372687004": "Penicillin Allergy", "764146007": "Sulfonamide Allergy",
        "387458008": "Aspirin Allergy", "7980": "Shellfish Allergy",
    }
    return LABELS.get(code, code)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
def pool_summary(db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    total = db.query(PoolContribution).count()
    research = db.query(PoolContribution).filter(PoolContribution.research_authorized == True).count()
    regions = db.query(func.count(func.distinct(PoolContribution.region))).scalar()
    clinics = db.query(func.count(func.distinct(PoolContribution.clinic_name))).scalar()
    today = db.query(PoolContribution).filter(
        PoolContribution.contributed_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
    ).count()
    return {
        "total_contributions": total,
        "research_authorized": research,
        "research_rate_pct": round(research / max(total, 1) * 100, 1),
        "unique_regions": regions,
        "unique_clinics": clinics,
        "contributed_today": today,
        "data_is_deidentified": True,
        "phi_in_pool": False,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/trends")
def pool_trends(weeks: int = Query(12, ge=1, le=52), db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = (
        db.query(PoolContribution.week_bucket, func.count(PoolContribution.id))
        .filter(PoolContribution.week_bucket.isnot(None))
        .group_by(PoolContribution.week_bucket)
        .order_by(PoolContribution.week_bucket)
        .all()
    )
    series = [{"week": r[0], "contributions": r[1]} for r in rows[-weeks:]]
    return {"series": series, "unit": "contributions_per_week"}


@router.get("/conditions")
def pool_conditions(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = db.query(PoolContribution.condition_codes).filter(PoolContribution.condition_codes.isnot(None)).all()
    counter: Counter = Counter()
    for (codes,) in rows:
        if isinstance(codes, list):
            for c in codes:
                counter[c] += 1
    top = [{"code": c, "label": _code_label(c), "count": n, "rank": i + 1}
           for i, (c, n) in enumerate(counter.most_common(limit))]
    return {"conditions": top, "total_records": len(rows)}


@router.get("/medications")
def pool_medications(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = db.query(PoolContribution.medication_codes).filter(PoolContribution.medication_codes.isnot(None)).all()
    counter: Counter = Counter()
    for (codes,) in rows:
        if isinstance(codes, list):
            for c in codes:
                counter[c] += 1
    top = [{"rxnorm": c, "label": _code_label(c), "count": n, "rank": i + 1}
           for i, (c, n) in enumerate(counter.most_common(limit))]
    return {"medications": top, "total_records": len(rows)}


@router.get("/allergies")
def pool_allergies(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = db.query(PoolContribution.allergy_codes).filter(PoolContribution.allergy_codes.isnot(None)).all()
    counter: Counter = Counter()
    for (codes,) in rows:
        if isinstance(codes, list):
            for c in codes:
                counter[c] += 1
    top = [{"code": c, "label": _code_label(c), "count": n, "rank": i + 1}
           for i, (c, n) in enumerate(counter.most_common(limit))]
    return {"allergies": top, "total_records": len(rows)}


@router.get("/regions")
def pool_regions(db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = (
        db.query(PoolContribution.region, func.count(PoolContribution.id).label("n"))
        .filter(PoolContribution.region.isnot(None))
        .group_by(PoolContribution.region)
        .order_by(func.count(PoolContribution.id).desc())
        .all()
    )
    return {
        "regions": [{"region": r[0], "contributions": r[1], "rank": i + 1}
                    for i, r in enumerate(rows)]
    }


@router.get("/research")
def pool_research(db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    total = db.query(PoolContribution).count()
    authorized = db.query(PoolContribution).filter(PoolContribution.research_authorized == True).count()
    by_age = (
        db.query(PoolContribution.age_bucket, func.count(PoolContribution.id))
        .filter(PoolContribution.research_authorized == True, PoolContribution.age_bucket.isnot(None))
        .group_by(PoolContribution.age_bucket)
        .order_by(PoolContribution.age_bucket)
        .all()
    )
    return {
        "research_authorized_total": authorized,
        "total_contributions": total,
        "authorization_rate_pct": round(authorized / max(total, 1) * 100, 1),
        "cohort_by_age": [{"age_bucket": r[0], "count": r[1]} for r in by_age],
        "framing": "Participants are compensated for voluntary research participation, not for accepting clinical treatment.",
        "irb_note": "Payment amounts and timing are subject to IRB review per 45 CFR 46.",
    }


@router.get("/live")
def pool_live(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    rows = (
        db.query(PoolContribution)
        .order_by(PoolContribution.contributed_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "live_feed": [
            {
                "id": r.id,
                "region": r.region,
                "clinic_name": r.clinic_name,
                "resource_types": r.resource_types,
                "condition_count": len(r.condition_codes or []),
                "research_authorized": r.research_authorized,
                "age_bucket": r.age_bucket,
                "contributed_at": r.contributed_at.isoformat() + "Z",
            }
            for r in rows
        ],
        "phi_in_feed": False,
    }


@router.get("/cds-signals")
def pool_cds_signals(db: Session = Depends(get_db)):
    """
    Aggregated signals for CDS engine consumption.
    Returns trending conditions, top allergy risks, medication patterns,
    and research cohort availability. All de-identified.
    """
    _ensure_demo_data(db)
    total = db.query(PoolContribution).count()
    last_week = datetime.utcnow() - timedelta(days=7)
    recent = db.query(PoolContribution).filter(PoolContribution.contributed_at >= last_week).count()

    cond_rows = db.query(PoolContribution.condition_codes).filter(PoolContribution.condition_codes.isnot(None)).all()
    cond_counter: Counter = Counter()
    for (codes,) in cond_rows:
        if isinstance(codes, list):
            for c in codes: cond_counter[c] += 1

    allergy_rows = db.query(PoolContribution.allergy_codes).filter(PoolContribution.allergy_codes.isnot(None)).all()
    allergy_counter: Counter = Counter()
    for (codes,) in allergy_rows:
        if isinstance(codes, list):
            for c in codes: allergy_counter[c] += 1

    research_available = db.query(PoolContribution).filter(PoolContribution.research_authorized == True).count()

    return {
        "pool_size": total,
        "contributions_last_7d": recent,
        "trending_conditions": [
            {"code": c, "label": _code_label(c), "count": n}
            for c, n in cond_counter.most_common(5)
        ],
        "top_allergy_risks": [
            {"code": c, "label": _code_label(c), "count": n}
            for c, n in allergy_counter.most_common(5)
        ],
        "research_cohort_available": research_available,
        "cds_prompts": [
            {"signal": "patient_eligible_for_study", "description": "Patient matches open research cohort criteria"},
            {"signal": "medication_list_needs_verification", "description": "Medication data not contributed in last 90d"},
            {"signal": "consent_expired", "description": "Research authorization older than 365 days"},
            {"signal": "missing_insurance_info", "description": "No Coverage resource in most recent bundle"},
            {"signal": "follow_up_recommended", "description": "No check-in in 90+ days"},
            {"signal": "abnormal_pro", "description": "Patient-reported outcome flagged in last submission"},
        ],
        "data_is_deidentified": True,
    }


# ── Clinician sign-off ────────────────────────────────────────────────────────

class ValidateContributionRequest(BaseModel):
    clinician_id: str           # NPI or identifier — not stored as PHI
    headline: str               # short case note written by clinician, no PHI
    category: str               # "Respiratory", "Cardiology", etc.


@router.post("/contributions/{contribution_id}/validate")
def validate_contribution(
    contribution_id: int,
    req: ValidateContributionRequest,
    db: Session = Depends(get_db),
):
    """
    Clinician signs off on a de-identified pool contribution.
    Only validated contributions appear on the public waiting room board.
    Clinician writes a short category and headline — no PHI allowed.
    """
    contrib = db.query(PoolContribution).filter(PoolContribution.id == contribution_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Contribution not found")
    if contrib.clinician_validated:
        raise HTTPException(status_code=400, detail="Already validated")

    contrib.clinician_validated = True
    contrib.validated_by = req.clinician_id
    contrib.validated_at = datetime.utcnow()
    contrib.headline = req.headline[:255]
    contrib.category = req.category[:80]
    db.commit()

    return {
        "id": contrib.id,
        "clinician_validated": True,
        "category": contrib.category,
        "headline": contrib.headline,
        "validated_at": contrib.validated_at.isoformat(),
        "appears_on_board": True,
    }


# ── Waiting room board ────────────────────────────────────────────────────────

@router.get("/board")
def waiting_room_board(
    clinic_name: Optional[str] = Query(None, description="Filter by clinic name"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Public waiting room board — clinician-validated entries only.
    No PHI. Shows category, headline, condition codes, region, age bucket, timestamp.
    Designed to be displayed on a TV/screen in the clinic waiting room.
    """
    _ensure_demo_data(db)
    q = db.query(PoolContribution).filter(PoolContribution.clinician_validated == True)
    if clinic_name:
        q = q.filter(PoolContribution.clinic_name == clinic_name)
    rows = q.order_by(PoolContribution.validated_at.desc()).limit(limit).all()

    total_validated = db.query(PoolContribution).filter(
        PoolContribution.clinician_validated == True
    ).count()
    total_pool = db.query(PoolContribution).count()

    cond_rows = db.query(PoolContribution.condition_codes).filter(
        PoolContribution.clinician_validated == True,
        PoolContribution.condition_codes.isnot(None),
    ).all()
    cond_counter: Counter = Counter()
    for (codes,) in cond_rows:
        if isinstance(codes, list):
            for c in codes:
                cond_counter[c] += 1

    by_category = (
        db.query(PoolContribution.category, func.count(PoolContribution.id))
        .filter(PoolContribution.clinician_validated == True, PoolContribution.category.isnot(None))
        .group_by(PoolContribution.category)
        .order_by(func.count(PoolContribution.id).desc())
        .all()
    )

    return {
        "board": [
            {
                "id": r.id,
                "category": r.category,
                "headline": r.headline,
                "conditions": [{"code": c, "label": _code_label(c)} for c in (r.condition_codes or [])],
                "region": r.region,
                "age_bucket": r.age_bucket,
                "research_authorized": r.research_authorized,
                "validated_at": r.validated_at.isoformat() + "Z" if r.validated_at else None,
                "clinic_name": r.clinic_name,
            }
            for r in rows
        ],
        "stats": {
            "total_validated": total_validated,
            "total_pool": total_pool,
            "pending_validation": total_pool - total_validated,
            "top_conditions": [
                {"code": c, "label": _code_label(c), "count": n}
                for c, n in cond_counter.most_common(5)
            ],
            "by_category": [{"category": r[0], "count": r[1]} for r in by_category],
        },
        "phi_in_board": False,
        "clinician_validated_only": True,
    }
