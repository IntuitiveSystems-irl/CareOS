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
