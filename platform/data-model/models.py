"""
Shared data models — used by data-model migrations service and imported by backend.
Updated for SMART on FHIR OAuth, AI layer, NFC sessions, and WebSocket support.
"""
import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, Date, DateTime,
    ForeignKey, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


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
    ehr_vendor = Column(SAEnum(EhrVendor), nullable=True)
    smart_discovery_mode = Column(String(50), default="smart_config")
    fhir_profile = Column(String(50), default="r4")

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
    approved_time_window = Column(String(50), nullable=True)
    approved_duration = Column(String(50), nullable=True)
    approved_categories = Column(Text, nullable=True)
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
    # AI summary generated for patient
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
    preferred_contact_method = Column(String(50), default="api_stub")
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
    preferred_specialist_office_ids = Column(JSON, nullable=True)

    patient = relationship("Patient", back_populates="fulfillment_preferences")
    preferred_lab = relationship("Destination", foreign_keys=[preferred_lab_id])
    preferred_pharmacy = relationship("Destination", foreign_keys=[preferred_pharmacy_id])
    preferred_primary_care_office = relationship("Destination", foreign_keys=[preferred_primary_care_office_id])
    preferred_payer = relationship("Destination", foreign_keys=[preferred_payer_id])


class OrderDraft(Base):
    __tablename__ = "order_drafts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    order_type = Column(SAEnum(OrderType), nullable=False)
    status = Column(SAEnum(OrderDraftStatus), default=OrderDraftStatus.drafted)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    drug_name = Column(String(255), nullable=True)
    drug_dosage = Column(String(100), nullable=True)
    drug_frequency = Column(String(100), nullable=True)
    drug_class = Column(String(100), nullable=True)
    lab_test_code = Column(String(50), nullable=True)
    lab_test_name = Column(String(255), nullable=True)
    icd_codes = Column(Text, nullable=True)
    prior_auth_likely = Column(SAEnum(PriorAuthLikelihood), default=PriorAuthLikelihood.unknown)
    payer_type = Column(String(100), nullable=True)
    patient_constraints = Column(JSON, nullable=True)
    destination_pharmacy_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    destination_lab_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    created_by = Column(String(255), nullable=True)
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
    __tablename__ = "patient_actions"

    id = Column(Integer, primary_key=True, index=True)
    order_draft_id = Column(Integer, ForeignKey("order_drafts.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    action_type = Column(SAEnum(PatientActionType), nullable=False)
    allow_generic_substitution = Column(Boolean, nullable=True)
    max_out_of_pocket = Column(Float, nullable=True)
    preferred_pharmacy_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    preferred_lab_id = Column(Integer, ForeignKey("destinations.id"), nullable=True)
    require_callback_before_changes = Column(Boolean, default=False)
    additional_constraints = Column(JSON, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order_draft = relationship("OrderDraft", back_populates="actions")
    patient = relationship("Patient", back_populates="patient_actions")
    preferred_pharmacy = relationship("Destination", foreign_keys=[preferred_pharmacy_id])
    preferred_lab = relationship("Destination", foreign_keys=[preferred_lab_id])


class AIInteraction(Base):
    """
    Logs AI layer interactions — GPT explanations, consent summaries, etc.
    """
    __tablename__ = "ai_interactions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    consent_session_id = Column(Integer, ForeignKey("consent_sessions.id"), nullable=True)
    interaction_type = Column(String(50), nullable=False)  # explain_consent, summarize_data, approve_assist
    prompt = Column(Text)
    response = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
