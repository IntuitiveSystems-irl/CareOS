import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, Date, DateTime,
    ForeignKey, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ── Enums ──

class AccessRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class NoteStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    flagged = "flagged"


class AllergySeverity(str, enum.Enum):
    mild = "mild"
    moderate = "moderate"
    severe = "severe"


class UseType(str, enum.Enum):
    primary_care = "primary_care"
    secondary_use = "secondary_use"


class SecondaryPurpose(str, enum.Enum):
    research = "research"
    quality_improvement = "quality_improvement"
    public_health = "public_health"
    operations_analytics = "operations_analytics"
    care_pattern_comparison = "care_pattern_comparison"


class NoteReviewStatus(str, enum.Enum):
    approved = "approved"
    flagged = "flagged"


class ConsentSessionStatus(str, enum.Enum):
    initiated = "initiated"
    pending_patient = "pending_patient"
    approved = "approved"
    denied = "denied"
    expired = "expired"


class TokenStatus(str, enum.Enum):
    active = "active"
    revoked = "revoked"
    expired = "expired"


class EhrVendor(str, enum.Enum):
    epic = "epic"
    cerner = "cerner"
    meditech = "meditech"
    other = "other"


class ClinicianRole(str, enum.Enum):
    physician = "physician"
    nurse = "nurse"
    physician_assistant = "physician_assistant"
    pharmacist = "pharmacist"
    care_coordinator = "care_coordinator"
    front_desk = "front_desk"
    admin = "admin"


class ClinicianStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class FeedbackSentiment(str, enum.Enum):
    concern = "concern"           # patient is worried about something
    preference = "preference"     # patient states a preference
    decline = "decline"           # patient declines / refuses
    question = "question"         # patient has a question
    agree = "agree"               # patient agrees / confirms


class FeedbackStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"


class DestinationKind(str, enum.Enum):
    lab = "lab"
    pharmacy = "pharmacy"
    provider = "provider"
    payer = "payer"


class FulfillmentPacketStatus(str, enum.Enum):
    created = "created"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"


class FulfillmentTaskType(str, enum.Enum):
    lab_order = "lab_order"
    pharmacy_rx = "pharmacy_rx"
    referral = "referral"
    insurance_packet = "insurance_packet"
    record_request = "record_request"


class FulfillmentTaskDestType(str, enum.Enum):
    lab = "lab"
    pharmacy = "pharmacy"
    provider = "provider"
    payer = "payer"


class FulfillmentTaskStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    acknowledged = "acknowledged"
    completed = "completed"
    failed = "failed"
    needs_patient_input = "needs_patient_input"


# ── Order State Machine ──

class OrderDraftStatus(str, enum.Enum):
    drafted = "drafted"
    awaiting_patient = "awaiting_patient"
    patient_approved = "patient_approved"
    patient_requested_change = "patient_requested_change"
    ready_to_submit = "ready_to_submit"
    submitted = "submitted"
    fulfilled = "fulfilled"
    failed = "failed"
    cancelled = "cancelled"


# Valid transitions enforced in the API layer
ORDER_TRANSITIONS = {
    OrderDraftStatus.drafted: [OrderDraftStatus.awaiting_patient, OrderDraftStatus.cancelled],
    OrderDraftStatus.awaiting_patient: [OrderDraftStatus.patient_approved, OrderDraftStatus.patient_requested_change, OrderDraftStatus.cancelled],
    OrderDraftStatus.patient_approved: [OrderDraftStatus.ready_to_submit],
    OrderDraftStatus.patient_requested_change: [OrderDraftStatus.drafted, OrderDraftStatus.cancelled],
    OrderDraftStatus.ready_to_submit: [OrderDraftStatus.submitted, OrderDraftStatus.cancelled],
    OrderDraftStatus.submitted: [OrderDraftStatus.fulfilled, OrderDraftStatus.failed],
    OrderDraftStatus.fulfilled: [],
    OrderDraftStatus.failed: [OrderDraftStatus.drafted],
    OrderDraftStatus.cancelled: [],
}


class OrderType(str, enum.Enum):
    medication = "medication"
    lab_order = "lab_order"
    referral = "referral"
    prior_auth = "prior_auth"
    imaging = "imaging"


class PatientActionType(str, enum.Enum):
    approve = "approve"
    approve_with_limits = "approve_with_limits"
    request_change = "request_change"
    reject = "reject"


class PriorAuthLikelihood(str, enum.Enum):
    yes = "yes"
    no = "no"
    unknown = "unknown"


# ── Models ──

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100))
    contact_email = Column(String(255))
    ehr_system_name = Column(String(255))
    # SMART on FHIR client registration
    client_id = Column(String(255), unique=True, nullable=True)
    client_secret = Column(String(255), nullable=True)
    redirect_uri = Column(String(512), nullable=True)
    fhir_base_url = Column(String(512), nullable=True)
    # Vendor adapter config
    ehr_vendor = Column(SAEnum(EhrVendor), nullable=True)  # epic | cerner | meditech | other
    smart_discovery_mode = Column(String(50), default="smart_config")  # smart_config | capability_statement
    fhir_profile = Column(String(50), default="r4")  # r4 | dstu2 | us_core_stu7

    access_requests = relationship("AccessRequest", back_populates="organization")
    consent_sessions = relationship("ConsentSession", back_populates="organization")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20))
    email = Column(String(255))
    phone = Column(String(30))
    address = Column(Text)

    clinical_notes = relationship("ClinicalNote", back_populates="patient")
    diagnoses = relationship("Diagnosis", back_populates="patient")
    medications = relationship("Medication", back_populates="patient")
    allergies = relationship("Allergy", back_populates="patient")
    lab_results = relationship("LabResult", back_populates="patient")
    encounters = relationship("Encounter", back_populates="patient")
    access_requests = relationship("AccessRequest", back_populates="patient")
    notifications = relationship("Notification", back_populates="patient")
    access_logs = relationship("AccessLog", back_populates="patient")
    consent_sessions = relationship("ConsentSession", back_populates="patient")
    note_reviews = relationship("NoteReview", back_populates="patient")
    fulfillment_packets = relationship("FulfillmentPacket", back_populates="patient")
    fulfillment_preferences = relationship("FulfillmentPreferences", back_populates="patient", uselist=False)
    order_drafts = relationship("OrderDraft", back_populates="patient")
    patient_actions = relationship("PatientAction", back_populates="patient")


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    author = Column(String(255), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    content = Column(Text, nullable=False)
    status = Column(SAEnum(NoteStatus), default=NoteStatus.pending_review)
    patient_comments = Column(Text)

    patient = relationship("Patient", back_populates="clinical_notes")


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    code = Column(String(20))
    description = Column(Text, nullable=False)
    date_diagnosed = Column(Date)
    status = Column(String(50), default="active")

    patient = relationship("Patient", back_populates="diagnoses")


class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    name = Column(String(255), nullable=False)
    dosage = Column(String(100))
    frequency = Column(String(100))
    prescriber = Column(String(255))
    start_date = Column(Date)
    end_date = Column(Date)

    patient = relationship("Patient", back_populates="medications")


class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    allergen = Column(String(255), nullable=False)
    reaction = Column(String(255))
    severity = Column(SAEnum(AllergySeverity))

    patient = relationship("Patient", back_populates="allergies")


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    test_name = Column(String(255), nullable=False)
    value = Column(String(100))
    unit = Column(String(50))
    reference_range = Column(String(100))
    date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="final")

    patient = relationship("Patient", back_populates="lab_results")


class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    provider = Column(String(255))
    location = Column(String(255))
    type = Column(String(100))
    summary = Column(Text)

    patient = relationship("Patient", back_populates="encounters")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    requesting_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    purpose = Column(Text)
    status = Column(SAEnum(AccessRequestStatus), default=AccessRequestStatus.pending)
    scopes = Column(Text, default="patient/*.read")
    use_type = Column(SAEnum(UseType), default=UseType.primary_care, nullable=False)
    secondary_purpose = Column(SAEnum(SecondaryPurpose), nullable=True)
    approved_time_window = Column(String(50), nullable=True)  # e.g. "12_months"
    approved_duration = Column(String(50), nullable=True)  # e.g. "one_time", "30_days"
    approved_categories = Column(Text, nullable=True)  # comma-separated FHIR types
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="access_requests")
    organization = relationship("Organization", back_populates="access_requests")
    payment = relationship("Payment", back_populates="access_request", uselist=False)
    notifications = relationship("Notification", back_populates="access_request")
    access_token = relationship("AccessToken", back_populates="access_request", uselist=False)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    access_request_id = Column(Integer, ForeignKey("access_requests.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)

    access_request = relationship("AccessRequest", back_populates="payment")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    access_request_id = Column(Integer, ForeignKey("access_requests.id"), nullable=True)

    patient = relationship("Patient", back_populates="notifications")
    access_request = relationship("AccessRequest", back_populates="notifications")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    requesting_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    action = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text)

    patient = relationship("Patient", back_populates="access_logs")


# ── SMART on FHIR / OAuth ──

class ConsentSession(Base):
    """
    Initiated by NFC tap or QR scan. Links a hospital request to a patient
    consent workflow. This is the SMART on FHIR launch context.
    """
    __tablename__ = "consent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    status = Column(SAEnum(ConsentSessionStatus), default=ConsentSessionStatus.initiated)
    scopes_requested = Column(Text, default="patient/*.read")
    purpose = Column(Text)
    launch_method = Column(String(50), default="web")  # nfc, qr, web
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    ai_summary = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="consent_sessions")
    organization = relationship("Organization", back_populates="consent_sessions")


class AccessToken(Base):
    """
    SMART on FHIR access token issued after patient consent + payment.
    Used by the requesting organization to pull FHIR resources.
    """
    __tablename__ = "access_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(512), unique=True, nullable=False, index=True)
    access_request_id = Column(Integer, ForeignKey("access_requests.id"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    scopes = Column(Text, default="patient/*.read")
    status = Column(SAEnum(TokenStatus), default=TokenStatus.active)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    access_request = relationship("AccessRequest", back_populates="access_token")


class ExternalEhrToken(Base):
    """
    OAuth token obtained *from* an external EHR (Epic / Cerner / MEDITECH /
    SMART reference sandbox).

    This is the OUTBOUND direction — CareOS acting as a SMART-on-FHIR app
    *client* pulling from a provider's FHIR server. It is deliberately
    distinct from ``AccessToken`` (the INBOUND direction, where CareOS is the
    authorization server issuing tokens to requesting orgs).
    """
    __tablename__ = "external_ehr_tokens"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(50), default="Bearer")
    scope = Column(Text, nullable=True)
    patient_context = Column(String(255), nullable=True)  # 'patient' claim from token response
    fhir_user = Column(String(512), nullable=True)
    status = Column(SAEnum(TokenStatus), default=TokenStatus.active)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class EhrAuthSession(Base):
    """
    Transient PKCE + ``state`` store for an in-flight SMART authorization-code
    flow. One row is created when we build the authorize URL and is marked
    completed (or failed) when the EHR redirects back to our callback.
    """
    __tablename__ = "ehr_auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(128), unique=True, index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    code_verifier = Column(String(256), nullable=False)
    scopes = Column(Text, nullable=True)
    redirect_back = Column(String(512), nullable=True)
    status = Column(String(32), default="pending")  # pending | completed | failed
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Clinician(Base):
    """
    A clinician / staff member who uses CareOS. Backs the clinician-management
    layer: identity (NPI), role-based access, org affiliation, and the
    ``clinician.<npi>`` audit-actor namespace.
    """
    __tablename__ = "clinicians"

    id = Column(Integer, primary_key=True, index=True)
    npi = Column(String(20), unique=True, nullable=True, index=True)  # National Provider Identifier
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    credential = Column(String(40), nullable=True)  # MD, DO, RN, NP, PA, PharmD, …
    specialty = Column(String(120), nullable=True)
    role = Column(SAEnum(ClinicianRole), default=ClinicianRole.physician, nullable=False)
    status = Column(SAEnum(ClinicianStatus), default=ClinicianStatus.active, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    password_hash = Column(String(255), nullable=True)  # pbkdf2$iterations$salt$hash
    session_token = Column(String(128), nullable=True, index=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization")

    @property
    def actor_name(self) -> str:
        """Audit-actor namespace: clinician.<npi> (falls back to id)."""
        return f"clinician.{self.npi or self.id}"

    @property
    def full_name(self) -> str:
        cred = f", {self.credential}" if self.credential else ""
        return f"{self.first_name} {self.last_name}{cred}".strip()


class PatientFeedback(Base):
    """
    The patient's voice — captured in the Patient Fishbowl and surfaced back to
    the clinician as deterministic CDS Hooks cards.

    ``target_kind`` + ``target_ref`` link the feedback to a specific record in
    the relational chart (a medication, problem, allergy, order, …), which is
    what lets the CDS card render in *relational style*.
    """
    __tablename__ = "patient_feedback"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    topic = Column(String(120), nullable=True)          # free label e.g. "medication", "general"
    target_kind = Column(String(40), nullable=True)     # problem | medication | allergy | lab | encounter | order
    target_ref = Column(String(120), nullable=True)     # chart entity id this feedback is about
    target_label = Column(String(255), nullable=True)   # human label snapshot (e.g. "Atorvastatin 40mg")
    sentiment = Column(SAEnum(FeedbackSentiment), default=FeedbackSentiment.concern, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(SAEnum(FeedbackStatus), default=FeedbackStatus.open, nullable=False)
    acknowledged_by = Column(String(120), nullable=True)  # clinician.<npi>
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient")


class NoteReview(Base):
    """Patient review of a clinical note (Open Notes)."""
    __tablename__ = "note_reviews"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("clinical_notes.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    status = Column(SAEnum(NoteReviewStatus), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="note_reviews")
    note = relationship("ClinicalNote")


# ── Fulfillment Routing ──

class Destination(Base):
    """Unified directory of labs, pharmacies, provider offices, and payers."""
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    kind = Column(SAEnum(DestinationKind), nullable=False)
    preferred_contact_method = Column(String(50), default="api_stub")  # fhir, api_stub, fax_stub, email_stub
    endpoint_url = Column(String(512), nullable=True)
    phone = Column(String(30), nullable=True)
    fax = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)


class FulfillmentPacket(Base):
    """Groups all post-visit fulfillment tasks for an encounter."""
    __tablename__ = "fulfillment_packets"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    source_note_id = Column(Integer, ForeignKey("clinical_notes.id"), nullable=True)
    status = Column(SAEnum(FulfillmentPacketStatus), default=FulfillmentPacketStatus.created)
    items_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="fulfillment_packets")
    tasks = relationship("FulfillmentTask", back_populates="packet", cascade="all, delete-orphan")


class FulfillmentTask(Base):
    """Individual routable task within a fulfillment packet."""
    __tablename__ = "fulfillment_tasks"

    id = Column(Integer, primary_key=True, index=True)
    packet_id = Column(Integer, ForeignKey("fulfillment_packets.id"), nullable=False)
    type = Column(SAEnum(FulfillmentTaskType), nullable=False)
    destination_type = Column(SAEnum(FulfillmentTaskDestType), nullable=False)
    destination_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    payload_json = Column(JSON, nullable=True)
    status = Column(SAEnum(FulfillmentTaskStatus), default=FulfillmentTaskStatus.queued)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_error = Column(Text, nullable=True)

    packet = relationship("FulfillmentPacket", back_populates="tasks")
    destination = relationship("Destination")


class FulfillmentPreferences(Base):
    """Patient's preferred routing destinations."""
    __tablename__ = "fulfillment_preferences"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, unique=True)
    preferred_lab_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_pharmacy_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_primary_care_office_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_payer_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_specialist_office_ids = Column(JSON, nullable=True)  # array of destination ids

    patient = relationship("Patient", back_populates="fulfillment_preferences")
    preferred_lab = relationship("Destination", foreign_keys=[preferred_lab_id])
    preferred_pharmacy = relationship("Destination", foreign_keys=[preferred_pharmacy_id])
    preferred_primary_care_office = relationship("Destination", foreign_keys=[preferred_primary_care_office_id])
    preferred_payer = relationship("Destination", foreign_keys=[preferred_payer_id])


# ── Order Workflow (MVP mediator loop) ──

class OrderDraft(Base):
    """
    A clinician-proposed order that enters the patient-in-the-loop workflow.
    State machine: DRAFTED → AWAITING_PATIENT → PATIENT_APPROVED|PATIENT_REQUESTED_CHANGE
                   → READY_TO_SUBMIT → SUBMITTED → FULFILLED|FAILED
    """
    __tablename__ = "order_drafts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    order_type = Column(SAEnum(OrderType), nullable=False)
    status = Column(SAEnum(OrderDraftStatus), default=OrderDraftStatus.drafted)

    # What the clinician is ordering
    title = Column(String(255), nullable=False)  # e.g. "Lisinopril 10mg" or "CBC with Diff"
    description = Column(Text, nullable=True)  # free-text clinical context
    drug_name = Column(String(255), nullable=True)  # medication orders
    drug_dosage = Column(String(100), nullable=True)
    drug_frequency = Column(String(100), nullable=True)
    drug_class = Column(String(100), nullable=True)  # for PA prediction
    lab_test_code = Column(String(50), nullable=True)  # lab orders (LOINC)
    lab_test_name = Column(String(255), nullable=True)
    icd_codes = Column(Text, nullable=True)  # comma-separated diagnosis codes

    # Prior auth prediction (stub → real later)
    prior_auth_likely = Column(SAEnum(PriorAuthLikelihood), default=PriorAuthLikelihood.unknown)
    payer_type = Column(String(100), nullable=True)  # e.g. "commercial", "medicare"

    # Patient-approved constraints (populated after patient action)
    patient_constraints = Column(JSON, nullable=True)  # structured rules from approve-with-limits

    # Routing preferences (resolved from patient prefs or explicit choice)
    destination_pharmacy_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    destination_lab_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)

    # Staff who created it
    created_by = Column(String(255), nullable=True)  # staff name/id
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    fulfilled_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="order_drafts")
    organization = relationship("Organization")
    actions = relationship("PatientAction", back_populates="order_draft", order_by="PatientAction.created_at")
    destination_pharmacy = relationship("Destination", foreign_keys=[destination_pharmacy_id])
    destination_lab = relationship("Destination", foreign_keys=[destination_lab_id])


class PatientAction(Base):
    """
    A patient's response to an OrderDraft — approve, approve with limits,
    request change, or reject. Each action is immutable (append-only log).
    """
    __tablename__ = "patient_actions"

    id = Column(Integer, primary_key=True, index=True)
    order_draft_id = Column(Integer, ForeignKey("order_drafts.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    action_type = Column(SAEnum(PatientActionType), nullable=False)

    # Approve-with-limits structured rules
    allow_generic_substitution = Column(Boolean, nullable=True)
    max_out_of_pocket = Column(Float, nullable=True)  # dollar amount
    preferred_pharmacy_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_lab_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    require_callback_before_changes = Column(Boolean, default=False)
    additional_constraints = Column(JSON, nullable=True)  # freeform extra rules

    comment = Column(Text, nullable=True)  # patient's note to the clinician
    created_at = Column(DateTime, default=datetime.utcnow)

    order_draft = relationship("OrderDraft", back_populates="actions")
    patient = relationship("Patient", back_populates="patient_actions")
    preferred_pharmacy = relationship("Destination", foreign_keys=[preferred_pharmacy_id])
    preferred_lab = relationship("Destination", foreign_keys=[preferred_lab_id])


class AIInteraction(Base):
    """Logs AI layer interactions for audit trail."""
    __tablename__ = "ai_interactions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    consent_session_id = Column(Integer, ForeignKey("consent_sessions.id"), nullable=True)
    interaction_type = Column(String(50), nullable=False)
    prompt = Column(Text)
    response = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Web3 Data Economy ─────────────────────────────────────────────────────────

class MemberIDStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    revoked = "revoked"


class DUAStatus(str, enum.Enum):
    pending_patient = "pending_patient"
    signed = "signed"
    expired = "expired"
    revoked = "revoked"


class DataPackageStatus(str, enum.Enum):
    pending = "pending"
    building = "building"
    ready = "ready"
    delivered = "delivered"
    failed = "failed"


class EscrowStatus(str, enum.Enum):
    funded = "funded"
    consent_pending = "consent_pending"
    data_pending = "data_pending"
    released = "released"
    refunded = "refunded"


class ParticipationStatus(str, enum.Enum):
    offered = "offered"
    accepted = "accepted"
    completed = "completed"
    validated = "validated"
    paid = "paid"
    declined = "declined"


class MemberID(Base):
    """
    Patient-owned universal member ID. Not PHI — maps via secure token only.
    QR-scannable alphanumeric code. No name/DOB/MRN exposed on the code itself.
    """
    __tablename__ = "member_ids"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, unique=True)
    member_code = Column(String(16), unique=True, nullable=False, index=True)
    did = Column(String(255), nullable=True)
    wallet_address = Column(String(42), nullable=True)
    status = Column(SAEnum(MemberIDStatus), default=MemberIDStatus.active)
    data_sharing_opt_in = Column(Boolean, default=False)
    order_participation_opt_in = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="member_id", uselist=False)
    agreements = relationship("DataUseAgreement", back_populates="member")


class DataUseAgreement(Base):
    """
    HIPAA authorization + data use agreement for a specific data buyer request.
    Consent hash goes on-chain; PHI never touches the blockchain.
    """
    __tablename__ = "data_use_agreements"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("member_ids.id"), nullable=False)
    buyer_org = Column(String(255), nullable=False)
    purpose = Column(Text, nullable=False)
    data_classes = Column(JSON, nullable=False)
    duration_days = Column(Integer, default=365)
    payment_amount_usd = Column(Float, nullable=False)
    payment_token = Column(String(10), default="USDC")
    status = Column(SAEnum(DUAStatus), default=DUAStatus.pending_patient)
    consent_hash = Column(String(66), nullable=True)
    patient_signature_ts = Column(DateTime, nullable=True)
    tx_hash = Column(String(66), nullable=True)
    contract_address = Column(String(42), nullable=True)
    ipfs_cid = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    member = relationship("MemberID", back_populates="agreements")
    data_packages = relationship("DataPackageRequest", back_populates="agreement")
    escrow = relationship("PaymentEscrowRecord", back_populates="agreement", uselist=False)


class CheckInStatus(str, enum.Enum):
    pending_patient   = "pending_patient"    # QR generated, waiting for patient approval
    patient_approved  = "patient_approved"   # patient chose what to share
    clinic_reviewing  = "clinic_reviewing"   # clinic scanned, reviewing package
    accepted          = "accepted"           # clinic accepted, FHIR written
    reward_released   = "reward_released"    # $10 sent to health wallet
    expired           = "expired"
    declined          = "declined"


class CheckInSession(Base):
    """
    One check-in session per patient visit. Token is the QR code payload.
    No PHI in the token — it resolves here.
    """
    __tablename__ = "checkin_sessions"

    id              = Column(Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False)
    member_id       = Column(Integer, ForeignKey("member_ids.id"), nullable=True)
    token           = Column(String(64), unique=True, nullable=False, index=True)
    clinic_name     = Column(String(255), nullable=True)
    clinic_npi      = Column(String(20), nullable=True)
    status          = Column(SAEnum(CheckInStatus), default=CheckInStatus.pending_patient)
    selected_resources = Column(JSON, nullable=True)   # list patient chose to share
    research_authorized = Column(Boolean, default=False)
    fhir_bundle_ref = Column(String(255), nullable=True)  # vault/IPFS ref
    reward_amount_usd = Column(Float, default=10.0)
    reward_token    = Column(String(10), default="USD")
    created_at      = Column(DateTime, default=datetime.utcnow)
    approved_at     = Column(DateTime, nullable=True)
    accepted_at     = Column(DateTime, nullable=True)
    reward_at       = Column(DateTime, nullable=True)
    expires_at      = Column(DateTime, nullable=True)

    patient = relationship("Patient", backref="checkin_sessions")


class HealthWallet(Base):
    """
    Patient health wallet — balance of earned credits/USD.
    One record per patient, updated on each reward event.
    """
    __tablename__ = "health_wallets"

    id              = Column(Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False, unique=True)
    balance_usd     = Column(Float, default=0.0)
    lifetime_earned = Column(Float, default=0.0)
    last_credit_at  = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="health_wallet", uselist=False)


class DataPackageRequest(Base):
    """
    FHIR Bundle assembled for a signed DUA. Stores metadata only — actual
    FHIR data lives in the encrypted off-chain vault.
    """
    __tablename__ = "data_package_requests"

    id = Column(Integer, primary_key=True, index=True)
    agreement_id = Column(Integer, ForeignKey("data_use_agreements.id"), nullable=False)
    resource_types = Column(JSON, nullable=False)
    record_count = Column(Integer, nullable=True)
    bundle_hash = Column(String(66), nullable=True)
    vault_ref = Column(String(255), nullable=True)
    status = Column(SAEnum(DataPackageStatus), default=DataPackageStatus.pending)
    built_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    agreement = relationship("DataUseAgreement", back_populates="data_packages")


class PaymentEscrowRecord(Base):
    """
    Off-chain mirror of the on-chain escrow contract state.
    tx_hash and contract_address are the authoritative on-chain anchors.
    PHI never stored here.
    """
    __tablename__ = "payment_escrow_records"

    id = Column(Integer, primary_key=True, index=True)
    agreement_id = Column(Integer, ForeignKey("data_use_agreements.id"), nullable=False, unique=True)
    contract_address = Column(String(42), nullable=True)
    amount_usd = Column(Float, nullable=False)
    token = Column(String(10), default="USDC")
    funded_tx = Column(String(66), nullable=True)
    release_tx = Column(String(66), nullable=True)
    status = Column(SAEnum(EscrowStatus), default=EscrowStatus.consent_pending)
    funded_at = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    agreement = relationship("DataUseAgreement", back_populates="escrow")


class OrderParticipation(Base):
    """
    Patient participation record for order/correction workflows.
    Patient is offered a task (verify lab, correct allergy, submit PRO),
    completes it, clinician validates, and payment is released.
    """
    __tablename__ = "order_participations"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("member_ids.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    task_type = Column(String(50), nullable=False)
    fhir_resource_type = Column(String(50), nullable=True)
    fhir_resource_id = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    reward_amount_usd = Column(Float, nullable=False)
    reward_token = Column(String(10), default="USDC")
    patient_response = Column(JSON, nullable=True)
    validated_by = Column(String(120), nullable=True)
    provenance_tx = Column(String(66), nullable=True)
    status = Column(SAEnum(ParticipationStatus), default=ParticipationStatus.offered)
    offered_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    validated_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)


# ── Global Data Pool ──────────────────────────────────────────────────────────

class PoolContribution(Base):
    """
    One de-identified record contributed to the global data pool per check-in.
    No PHI. Aggregated for live dashboards and CDS.
    Region is coarse (state/country), never ZIP or address.
    """
    __tablename__ = "pool_contributions"

    id              = Column(Integer, primary_key=True, index=True)
    session_id      = Column(Integer, ForeignKey("checkin_sessions.id"), nullable=False)
    region          = Column(String(50), nullable=True)   # "CA-US", "NY-US", "UK", etc.
    clinic_name     = Column(String(255), nullable=True)
    resource_types  = Column(JSON, nullable=False)        # what was shared (no values)
    condition_codes = Column(JSON, nullable=True)         # ICD/SNOMED codes only
    medication_codes= Column(JSON, nullable=True)         # RxNorm codes only
    allergy_codes   = Column(JSON, nullable=True)         # SNOMED/RxNorm codes only
    research_authorized = Column(Boolean, default=False)
    age_bucket      = Column(String(10), nullable=True)   # "18-24","25-34","35-44", etc.
    sex             = Column(String(1), nullable=True)    # M/F/U — not a PHI risk at aggregate
    contributed_at  = Column(DateTime, default=datetime.utcnow)
    week_bucket     = Column(String(10), nullable=True)   # "2026-W26" for time-series
    clinician_validated = Column(Boolean, default=False)  # must be True to appear on public board
    validated_by    = Column(String(120), nullable=True)  # clinician NPI or identifier
    validated_at    = Column(DateTime, nullable=True)
    headline        = Column(String(255), nullable=True)  # short clinician-written case note (no PHI)
    category        = Column(String(80), nullable=True)   # "Respiratory", "Cardiology", etc.


class WalletTransaction(Base):
    """
    Immutable ledger of all health wallet credits and debits.
    """
    __tablename__ = "wallet_transactions"

    id              = Column(Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False)
    wallet_id       = Column(Integer, ForeignKey("health_wallets.id"), nullable=False)
    amount_usd      = Column(Float, nullable=False)       # positive = credit, negative = debit
    category        = Column(String(50), nullable=False)  # research_payment, copay, prescription, etc.
    description     = Column(Text, nullable=True)
    reference_id    = Column(String(100), nullable=True)  # checkin_session_id, claim_id, etc.
    created_at      = Column(DateTime, default=datetime.utcnow)
