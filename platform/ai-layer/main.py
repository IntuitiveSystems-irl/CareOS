"""
AI Layer — GPT Actions service for the Patient Health Data Agent.

Exposes OpenAPI-compatible endpoints that a Custom GPT can call:
  - Explain a consent request to the patient
  - Summarize what data is being requested
  - Help patient approve/deny and generate a response
  - Trigger backend to create/confirm consent, issue tokens, log events

This service talks to the main backend over HTTP and to OpenAI for LLM calls.
"""
import json
import os
import secrets
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# ── Config ──

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://agent:agent_secret@db:5432/patient_agent")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Pydantic Schemas ──

class ConsentExplainRequest(BaseModel):
    consent_session_id: Optional[int] = None
    organization_name: str = Field(..., description="Name of the requesting organization")
    purpose: str = Field(..., description="Stated purpose of the data access")
    scopes: str = Field(default="patient/*.read", description="SMART on FHIR scopes being requested")
    patient_name: str = Field(default="Patient", description="Patient's first name for personalization")
    use_type: str = Field(default="primary_care", description="'primary_care' or 'secondary_use'")
    secondary_purpose: Optional[str] = Field(None, description="If secondary_use: research, quality_improvement, public_health, operations_analytics, care_pattern_comparison")

class ConsentExplainResponse(BaseModel):
    explanation: str = Field(..., description="Patient-friendly explanation of the consent request")
    risk_summary: str = Field(..., description="Brief summary of potential risks or considerations")
    recommendation: str = Field(..., description="AI recommendation (informational only)")
    use_type_label: str = Field(default="Primary Care", description="Human label for use type")
    suggested_actions: List[str] = Field(default_factory=lambda: ["Approve", "Deny"], description="Suggested patient actions")

class DataSummaryRequest(BaseModel):
    patient_id: int
    scopes: str = Field(default="patient/*.read", description="SMART on FHIR scopes to summarize")

class DataSummaryResponse(BaseModel):
    summary: str = Field(..., description="Human-readable summary of what data would be shared")
    resource_types: List[str] = Field(..., description="FHIR resource types included")
    record_count: int = Field(0, description="Approximate number of records")

class ConsentDecisionRequest(BaseModel):
    consent_session_id: int = Field(..., description="ID of the consent session")
    patient_id: int = Field(..., description="Patient ID making the decision")
    decision: str = Field(..., description="'approve', 'deny', or 'approve_with_limits'")
    reason: Optional[str] = Field(None, description="Optional reason for the decision")
    time_window: Optional[str] = Field(None, description="Limit: e.g. '12_months', 'all'")
    duration: Optional[str] = Field(None, description="Limit: 'one_time', '30_days', '90_days'")
    categories: Optional[str] = Field(None, description="Limit: comma-separated FHIR types")


class NoteTranslateRequest(BaseModel):
    note_content: str = Field(..., description="Clinical note text to translate")
    patient_name: str = Field(default="Patient")

class NoteTranslateResponse(BaseModel):
    plain_language: str = Field(..., description="Plain-language translation of the clinical note")
    key_points: List[str] = Field(default_factory=list, description="Key medical points extracted")

class NoteVerifyRequest(BaseModel):
    note_content: str = Field(..., description="Clinical note text to verify")
    patient_name: str = Field(default="Patient")

class NoteVerifyResponse(BaseModel):
    checklist: List[str] = Field(..., description="Things the patient should verify")
    common_errors: List[str] = Field(default_factory=list, description="Common documentation errors to watch for")

class ConsentDecisionResponse(BaseModel):
    status: str
    message: str
    access_token: Optional[str] = None
    token_expires_at: Optional[str] = None

class NfcLaunchRequest(BaseModel):
    organization_id: int
    patient_id: int
    scopes: str = Field(default="patient/*.read")
    purpose: str = Field(default="Continuity of care")

class NfcLaunchResponse(BaseModel):
    session_token: str
    session_id: int
    launch_url: str
    qr_payload: str
    expires_at: str

class SessionStatusRequest(BaseModel):
    session_token: str

class SessionStatusResponse(BaseModel):
    session_id: int
    status: str
    organization_name: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: str


# ── LLM Helper ──

async def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call OpenAI (or return a mock if no key is set)."""
    if not OPENAI_API_KEY:
        return _mock_llm_response(system_prompt, user_prompt)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 500,
                "temperature": 0.4,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def _mock_llm_response(system_prompt: str, user_prompt: str) -> str:
    """Deterministic mock when no OpenAI key is configured."""
    lp = system_prompt.lower()
    if "translate" in lp or "plain language" in lp:
        return (
            "Your doctor noted that your blood sugar levels (HbA1c) are slightly above "
            "the target range at 7.2%. Your blood pressure is also a bit elevated at 138/88. "
            "They recommend continuing your current medications, eating less salt, exercising "
            "regularly, and coming back for follow-up labs in 3 months."
        )
    if "verify" in lp or "checklist" in lp:
        return (
            "1. Verify your medication list is complete and dosages are correct\n"
            "2. Confirm the reported symptoms match your experience\n"
            "3. Check that allergy information is up to date\n"
            "4. Verify the follow-up timeline works for your schedule\n"
            "5. Confirm you discussed all concerns mentioned in the note"
        )
    if "secondary" in user_prompt.lower() or "research" in user_prompt.lower():
        return (
            "This is a SECONDARY USE request. The organization wants to use your "
            "de-identified health data for research purposes. This will NOT directly "
            "benefit your personal care, but may contribute to medical research that "
            "helps future patients. Your data would include diagnoses, lab results, "
            "and medication history. You have the right to deny this request with no "
            "impact on your care. You can also approve with limits — for example, "
            "restricting to the last 12 months or one-time access only."
        )
    if "explain" in lp:
        return (
            "This is a PRIMARY CARE request. A healthcare organization is requesting "
            "access to your health records to provide you with coordinated care. "
            "The data they're requesting includes your medical conditions, medications, "
            "lab results, and clinical encounters. You have full control over whether "
            "to approve or deny this request. You can also approve with limits."
        )
    if "summarize" in lp:
        return (
            "This request would share your: diagnoses (3 records), medications (3 records), "
            "allergies (3 records), lab results (5 records), and encounter history (3 records). "
            "No mental health or substance abuse records are included in this scope."
        )
    return (
        "I've processed your request. Your decision has been recorded and the "
        "requesting organization has been notified."
    )


# ── App ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="Patient Health Data Agent — AI Layer",
    description=(
        "AI-powered assistant for patient consent management. "
        "Designed as GPT Actions backend — explain consent requests, "
        "summarize data, help patients make informed decisions."
    ),
    version="1.0.0",
    lifespan=lifespan,
    servers=[
        {"url": "http://localhost:8100", "description": "Local development"},
        {"url": "http://ai-layer:8100", "description": "Docker internal"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints for GPT Actions ──

@app.post(
    "/consent/explain",
    response_model=ConsentExplainResponse,
    summary="Explain a consent request to the patient",
    description="Given an organization's access request details, generate a patient-friendly explanation.",
)
async def explain_consent(req: ConsentExplainRequest):
    is_secondary = req.use_type == "secondary_use"
    use_label = "Secondary Use" if is_secondary else "Primary Care"

    secondary_context = ""
    if is_secondary and req.secondary_purpose:
        purpose_labels = {
            "research": "medical research",
            "quality_improvement": "quality improvement",
            "public_health": "public health reporting",
            "operations_analytics": "operations analytics",
            "care_pattern_comparison": "care pattern comparison",
        }
        secondary_context = (
            f"\nThis is a SECONDARY USE request for {purpose_labels.get(req.secondary_purpose, req.secondary_purpose)}. "
            "This data use may NOT directly benefit the patient's personal care, but can benefit "
            "research, quality improvement, or public health. "
            "The patient should understand: what data is shared, who sees it, and for how long."
        )

    system_prompt = (
        "You are a helpful patient health data assistant. Explain the following "
        "data access request in clear, simple language. Be reassuring but honest "
        "about what data will be shared. Mention patient rights. "
        "Always clearly state whether this is a PRIMARY CARE or SECONDARY USE request. "
        "For secondary use, explain that this may not directly benefit the patient. "
        "Include transparency about: what data is shared, who sees it, and duration. "
        "Suggest options: Approve, Deny, or Approve with limits (time window, categories, duration)."
        + secondary_context
    )
    user_prompt = (
        f"Organization: {req.organization_name}\n"
        f"Purpose: {req.purpose}\n"
        f"Use Type: {use_label}\n"
        f"Secondary Purpose: {req.secondary_purpose or 'N/A'}\n"
        f"SMART on FHIR Scopes: {req.scopes}\n"
        f"Patient name: {req.patient_name}\n\n"
        "Please provide:\n"
        "1. A clear explanation of what this request means\n"
        "2. Whether this is primary care or secondary use\n"
        "3. What data will be shared and who sees it\n"
        "4. Duration / retention info\n"
        "5. Suggested actions: Approve / Deny / Approve with limits"
    )
    explanation = await call_llm(system_prompt, user_prompt)

    risk_prompt = (
        "You are a health data privacy advisor. Given this data access request, "
        "briefly summarize potential risks or things the patient should consider. "
        "Be especially clear about secondary use implications if applicable."
    )
    risk_summary = await call_llm(risk_prompt, user_prompt)

    suggested_actions = ["Approve", "Deny", "Approve with limits"]
    if is_secondary:
        recommendation = (
            f"This is a secondary use request for {req.secondary_purpose or 'unspecified purpose'}. "
            "This may not directly benefit your care but can advance medical knowledge. "
            "Consider approving with limits such as restricting to the last 12 months or one-time access."
        )
    else:
        recommendation = "This appears to be a standard care coordination request. Review the details before deciding."

    return ConsentExplainResponse(
        explanation=explanation,
        risk_summary=risk_summary,
        recommendation=recommendation,
        use_type_label=use_label,
        suggested_actions=suggested_actions,
    )


@app.post(
    "/consent/summarize-data",
    response_model=DataSummaryResponse,
    summary="Summarize what patient data would be shared",
    description="Fetch patient record counts and generate a human-readable summary of what would be shared.",
)
async def summarize_data(req: DataSummaryRequest):
    # Fetch actual record counts from backend
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=10) as client:
        try:
            resp = await client.get(f"/api/patients/{req.patient_id}/records")
            resp.raise_for_status()
            records = resp.json()
        except Exception:
            records = {}

    resource_types = []
    total_count = 0

    scope_parts = req.scopes.split()
    read_all = any("*" in s for s in scope_parts)

    type_map = {
        "Condition": ("diagnoses", "patient/Condition.read"),
        "MedicationRequest": ("medications", "patient/MedicationRequest.read"),
        "AllergyIntolerance": ("allergies", "patient/AllergyIntolerance.read"),
        "Observation": ("lab_results", "patient/Observation.read"),
        "Encounter": ("encounters", "patient/Encounter.read"),
    }

    for fhir_type, (key, scope) in type_map.items():
        if read_all or scope in scope_parts:
            resource_types.append(fhir_type)
            if key in records:
                total_count += len(records[key])

    system_prompt = (
        "You are a patient health data assistant. Summarize what data would be "
        "shared based on the following record counts. Be specific and reassuring."
    )
    data_detail = ", ".join(
        f"{ft}: {len(records.get(type_map[ft][0], []))} records" for ft in resource_types
    )
    user_prompt = f"Data to be shared: {data_detail}\nScopes: {req.scopes}"
    summary = await call_llm(system_prompt, user_prompt)

    return DataSummaryResponse(
        summary=summary,
        resource_types=resource_types,
        record_count=total_count,
    )


@app.post(
    "/consent/decide",
    response_model=ConsentDecisionResponse,
    summary="Record patient's consent decision",
    description="Patient approves or denies a consent session. If approved, triggers token issuance via backend.",
)
async def decide_consent(req: ConsentDecisionRequest, db: Session = Depends(get_db)):
    # Import models here to avoid import-time DB dependency
    from models import ConsentSession, ConsentSessionStatus

    session = db.query(ConsentSession).filter(ConsentSession.id == req.consent_session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Consent session not found")

    if session.patient_id != req.patient_id:
        raise HTTPException(status_code=403, detail="This consent session does not belong to this patient")

    if session.status not in (ConsentSessionStatus.initiated, ConsentSessionStatus.pending_patient):
        raise HTTPException(status_code=400, detail=f"Session already resolved: {session.status.value}")

    if req.decision == "approve":
        session.status = ConsentSessionStatus.approved
        session.resolved_at = datetime.utcnow()
        db.commit()

        # Tell backend to create access request + issue token
        async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=10) as client:
            resp = await client.post("/api/access-requests/", json={
                "patient_id": session.patient_id,
                "requesting_org_id": session.organization_id,
                "purpose": session.purpose or "Approved via AI consent assistant",
                "scopes": session.scopes_requested,
            })
            if resp.status_code in (200, 201):
                ar = resp.json()
                # Auto-approve it
                await client.put(f"/api/access-requests/{ar['id']}", json={"status": "approved"})

                return ConsentDecisionResponse(
                    status="approved",
                    message="Consent granted. The organization can now request a FHIR access token.",
                    access_token=None,  # Token issued during SMART token exchange
                )

        return ConsentDecisionResponse(status="approved", message="Consent granted.")

    elif req.decision == "deny":
        session.status = ConsentSessionStatus.denied
        session.resolved_at = datetime.utcnow()
        db.commit()

        return ConsentDecisionResponse(status="denied", message="Consent denied. No data will be shared.")

    else:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'deny'")


@app.post(
    "/session/initiate-nfc",
    response_model=NfcLaunchResponse,
    summary="Initiate consent session via NFC/QR tap",
    description="Called when patient taps NFC tag or hospital scans QR. Creates a one-time session.",
)
async def initiate_nfc_session(req: NfcLaunchRequest, db: Session = Depends(get_db)):
    from models import ConsentSession, ConsentSessionStatus

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(minutes=15)

    session = ConsentSession(
        session_token=token,
        patient_id=req.patient_id,
        organization_id=req.organization_id,
        status=ConsentSessionStatus.pending_patient,
        scopes_requested=req.scopes,
        purpose=req.purpose,
        launch_method="nfc",
        expires_at=expires,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Notify backend to push real-time notification
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=5) as client:
        try:
            await client.post("/api/ws/notify", json={
                "patient_id": req.patient_id,
                "type": "consent_request",
                "message": f"New consent request from Organization #{req.organization_id}",
                "session_id": session.id,
            })
        except Exception:
            pass  # Non-critical

    launch_url = f"/patient/consent?session={token}"
    qr_payload = f"https://your-domain.com{launch_url}"

    return NfcLaunchResponse(
        session_token=token,
        session_id=session.id,
        launch_url=launch_url,
        qr_payload=qr_payload,
        expires_at=expires.isoformat(),
    )


@app.post(
    "/session/status",
    response_model=SessionStatusResponse,
    summary="Check consent session status",
)
async def get_session_status(req: SessionStatusRequest, db: Session = Depends(get_db)):
    from models import ConsentSession, Organization

    session = db.query(ConsentSession).filter(ConsentSession.session_token == req.session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    org = db.query(Organization).filter(Organization.id == session.organization_id).first()

    return SessionStatusResponse(
        session_id=session.id,
        status=session.status.value,
        organization_name=org.name if org else None,
        ai_summary=session.ai_summary,
        created_at=session.created_at.isoformat(),
    )


@app.post(
    "/audit/log",
    summary="Log an AI interaction event",
    description="Records AI-assisted interactions for audit trail.",
)
async def log_ai_interaction(
    patient_id: int,
    interaction_type: str,
    prompt: str = "",
    response: str = "",
    consent_session_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    from models import AIInteraction

    log = AIInteraction(
        patient_id=patient_id,
        consent_session_id=consent_session_id,
        interaction_type=interaction_type,
        prompt=prompt,
        response=response,
    )
    db.add(log)
    db.commit()
    return {"status": "logged", "id": log.id}


@app.post(
    "/notes/translate",
    response_model=NoteTranslateResponse,
    summary="Translate a clinical note to plain language",
    description="Given clinical note text, produce a patient-friendly translation and key points.",
)
async def translate_note(req: NoteTranslateRequest):
    system_prompt = (
        "You are a patient health literacy assistant. Translate the following clinical note "
        "into clear, simple plain language that a non-medical person can understand. "
        "Also extract 3-5 key medical points as bullet items."
    )
    user_prompt = f"Patient: {req.patient_name}\n\nClinical Note:\n{req.note_content}"
    translation = await call_llm(system_prompt, user_prompt)

    # Extract key points
    kp_prompt = (
        "You are a medical summarizer. Extract 3-5 key medical points from the following "
        "clinical note as short bullet items. Return only the bullet items, one per line."
    )
    kp_raw = await call_llm(kp_prompt, req.note_content)
    key_points = [line.strip().lstrip("•-*0123456789. ") for line in kp_raw.strip().split("\n") if line.strip()]

    return NoteTranslateResponse(plain_language=translation, key_points=key_points[:5])


@app.post(
    "/notes/verify",
    response_model=NoteVerifyResponse,
    summary="Generate a verification checklist for a clinical note",
    description="Help patient verify accuracy of their clinical note by providing a checklist and common errors.",
)
async def verify_note(req: NoteVerifyRequest):
    system_prompt = (
        "You are a patient advocate helping verify clinical note accuracy. "
        "Generate a checklist of 4-6 things the patient should verify in this note. "
        "Also list 2-3 common documentation errors patients should watch for. "
        "Return the checklist items numbered, then common errors numbered."
    )
    user_prompt = f"Patient: {req.patient_name}\n\nClinical Note:\n{req.note_content}"
    raw = await call_llm(system_prompt, user_prompt)

    lines = [l.strip().lstrip("•-*0123456789. ") for l in raw.strip().split("\n") if l.strip()]
    # Split: first batch = checklist, last 2-3 = common errors
    checklist = lines[:5] if len(lines) > 3 else lines
    common_errors = lines[5:] if len(lines) > 5 else [
        "Medication dosages may be recorded incorrectly",
        "Symptom descriptions may not match your experience",
        "Follow-up dates may be wrong",
    ]

    return NoteVerifyResponse(checklist=checklist, common_errors=common_errors)


# ── Fulfillment Summarize ──

class FulfillmentSummarizeRequest(BaseModel):
    items_json: dict


class FulfillmentSummarizeResponse(BaseModel):
    checklist: list[str]
    what_to_expect: list[str]
    patient_actions: list[str]


@app.post(
    "/fulfillment/summarize",
    response_model=FulfillmentSummarizeResponse,
    summary="Summarize a fulfillment packet for the patient",
)
async def fulfillment_summarize(req: FulfillmentSummarizeRequest):
    """Generate a patient-friendly summary of a fulfillment packet."""
    system_prompt = (
        "You are a healthcare assistant helping a patient understand their post-visit tasks. "
        "Given a JSON summary of their fulfillment items (medications, lab orders, diagnoses, referrals), "
        "produce three sections:\n"
        "1. CHECKLIST: bullet list of what is being routed on their behalf\n"
        "2. WHAT TO EXPECT: timeline of what happens next\n"
        "3. PATIENT ACTIONS: things the patient needs to do (e.g., go to lab, pick up Rx)\n"
        "Keep it simple and reassuring. No medical jargon."
    )
    user_prompt = f"Fulfillment items:\n{json.dumps(req.items_json, indent=2)}"

    raw = await call_llm(system_prompt, user_prompt)

    # Parse sections from LLM response
    checklist = []
    what_to_expect = []
    patient_actions = []
    current = checklist
    for line in raw.strip().split("\n"):
        stripped = line.strip().lstrip("•-*0123456789. ")
        if not stripped:
            continue
        lower = stripped.lower()
        if "expect" in lower and len(stripped) < 40:
            current = what_to_expect
            continue
        if "action" in lower and len(stripped) < 40:
            current = patient_actions
            continue
        if "checklist" in lower and len(stripped) < 40:
            current = checklist
            continue
        current.append(stripped)

    # Fallbacks
    if not checklist:
        checklist = ["Your lab orders, prescriptions, referrals, and insurance documents are being processed."]
    if not what_to_expect:
        what_to_expect = [
            "Lab orders will be sent to your preferred lab within minutes.",
            "Prescriptions will be routed to your pharmacy.",
            "Referral packets will be sent to the specialist office.",
            "Insurance/prior-auth will be submitted to your payer.",
        ]
    if not patient_actions:
        patient_actions = [
            "Visit your preferred lab for blood work.",
            "Pick up your prescription at your pharmacy.",
            "Watch for a call from the specialist office to schedule.",
        ]

    return FulfillmentSummarizeResponse(
        checklist=checklist,
        what_to_expect=what_to_expect,
        patient_actions=patient_actions,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-layer"}


@app.get(
    "/openapi-actions.json",
    summary="OpenAPI schema for Custom GPT Actions",
    description="Use this URL when configuring GPT Actions in the GPT Builder.",
)
async def openapi_for_gpt():
    """Returns the OpenAPI schema formatted for GPT Actions import."""
    return app.openapi()
