from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel

from app.models import (
    AccessRequestStatus, PaymentStatus, NoteStatus, AllergySeverity,
    ConsentSessionStatus, TokenStatus, UseType, SecondaryPurpose, NoteReviewStatus,
    DestinationKind, FulfillmentPacketStatus, FulfillmentTaskType,
    FulfillmentTaskDestType, FulfillmentTaskStatus, EhrVendor,
    OrderDraftStatus, OrderType, PatientActionType, PriorAuthLikelihood,
    ClinicianRole, ClinicianStatus, FeedbackSentiment, FeedbackStatus,
)


# ── Organization ──

class OrganizationBase(BaseModel):
    name: str
    type: Optional[str] = None
    contact_email: Optional[str] = None
    ehr_system_name: Optional[str] = None
    client_id: Optional[str] = None
    redirect_uri: Optional[str] = None
    fhir_base_url: Optional[str] = None
    ehr_vendor: Optional[str] = None
    smart_discovery_mode: Optional[str] = None
    fhir_profile: Optional[str] = None


class OrganizationOut(OrganizationBase):
    id: int
    model_config = {"from_attributes": True}


class OrganizationCreate(OrganizationBase):
    # client_secret is accepted on create/update but never returned in OrganizationOut.
    client_secret: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    contact_email: Optional[str] = None
    ehr_system_name: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    fhir_base_url: Optional[str] = None
    ehr_vendor: Optional[str] = None
    smart_discovery_mode: Optional[str] = None
    fhir_profile: Optional[str] = None


class EhrConnectionStatusOut(BaseModel):
    org_id: int
    org_name: str
    connected: bool
    status: str
    scope: Optional[str] = None
    patient_context: Optional[str] = None
    token_type: Optional[str] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    has_refresh_token: Optional[bool] = None


class EhrAdapterInfoOut(BaseModel):
    org_id: int
    org_name: str
    ehr_vendor: Optional[str] = None
    fhir_base_url: Optional[str] = None
    fhir_profile: Optional[str] = None
    smart_discovery_mode: Optional[str] = None
    authorization_endpoint: str
    token_endpoint: str
    introspection_endpoint: str
    scopes_supported: list[str]
    capabilities: list[str]
    supported_resources: list[str]


# ── Patient ──

class PatientBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class PatientOut(PatientBase):
    id: int
    model_config = {"from_attributes": True}


# ── Clinical Note ──

class ClinicalNoteOut(BaseModel):
    id: int
    patient_id: int
    author: str
    date: datetime
    content: str
    status: NoteStatus
    patient_comments: Optional[str] = None
    model_config = {"from_attributes": True}


class ClinicalNoteUpdate(BaseModel):
    status: Optional[NoteStatus] = None
    patient_comments: Optional[str] = None


# ── Diagnosis ──

class DiagnosisOut(BaseModel):
    id: int
    patient_id: int
    code: Optional[str] = None
    description: str
    date_diagnosed: Optional[date] = None
    status: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Medication ──

class MedicationOut(BaseModel):
    id: int
    patient_id: int
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    prescriber: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    model_config = {"from_attributes": True}


# ── Allergy ──

class AllergyOut(BaseModel):
    id: int
    patient_id: int
    allergen: str
    reaction: Optional[str] = None
    severity: Optional[AllergySeverity] = None
    model_config = {"from_attributes": True}


# ── Lab Result ──

class LabResultOut(BaseModel):
    id: int
    patient_id: int
    test_name: str
    value: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    date: datetime
    status: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Encounter ──

class EncounterOut(BaseModel):
    id: int
    patient_id: int
    date: datetime
    provider: Optional[str] = None
    location: Optional[str] = None
    type: Optional[str] = None
    summary: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Access Request ──

class AccessRequestCreate(BaseModel):
    patient_id: int
    requesting_org_id: int
    purpose: Optional[str] = None
    scopes: Optional[str] = "patient/*.read"
    use_type: UseType = UseType.primary_care
    secondary_purpose: Optional[SecondaryPurpose] = None


class AccessRequestOut(BaseModel):
    id: int
    patient_id: int
    requesting_org_id: int
    purpose: Optional[str] = None
    status: AccessRequestStatus
    scopes: Optional[str] = None
    use_type: UseType = UseType.primary_care
    secondary_purpose: Optional[SecondaryPurpose] = None
    approved_time_window: Optional[str] = None
    approved_duration: Optional[str] = None
    approved_categories: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    organization: Optional[OrganizationOut] = None
    model_config = {"from_attributes": True}


class AccessRequestUpdate(BaseModel):
    status: AccessRequestStatus
    approved_time_window: Optional[str] = None
    approved_duration: Optional[str] = None
    approved_categories: Optional[str] = None


# ── Payment ──

class PaymentOut(BaseModel):
    id: int
    access_request_id: int
    amount: float
    status: PaymentStatus
    created_at: datetime
    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    access_request_id: int


# ── Notification ──

class NotificationOut(BaseModel):
    id: int
    patient_id: int
    type: str
    message: str
    read: bool
    created_at: datetime
    access_request_id: Optional[int] = None
    model_config = {"from_attributes": True}


class NotificationUpdate(BaseModel):
    read: bool = True


# ── Access Log ──

class AccessLogOut(BaseModel):
    id: int
    patient_id: int
    requesting_org_id: Optional[int] = None
    action: str
    timestamp: datetime
    details: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Patient Records (aggregated) ──

class PatientRecords(BaseModel):
    patient: PatientOut
    clinical_notes: list[ClinicalNoteOut] = []
    diagnoses: list[DiagnosisOut] = []
    medications: list[MedicationOut] = []
    allergies: list[AllergyOut] = []
    lab_results: list[LabResultOut] = []
    encounters: list[EncounterOut] = []


# ── SMART on FHIR / Consent Session ──

class ConsentSessionOut(BaseModel):
    id: int
    session_token: str
    patient_id: int
    organization_id: int
    status: ConsentSessionStatus
    scopes_requested: Optional[str] = None
    purpose: Optional[str] = None
    launch_method: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    ai_summary: Optional[str] = None
    model_config = {"from_attributes": True}


class AccessTokenOut(BaseModel):
    id: int
    token: str
    access_request_id: int
    patient_id: int
    organization_id: int
    scopes: Optional[str] = None
    status: TokenStatus
    issued_at: datetime
    expires_at: datetime
    model_config = {"from_attributes": True}


# ── Note Review (Open Notes) ──

class NoteReviewCreate(BaseModel):
    status: NoteReviewStatus
    comment: Optional[str] = None


class NoteReviewOut(BaseModel):
    id: int
    note_id: int
    patient_id: int
    status: NoteReviewStatus
    comment: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Patient Access Log (enriched view) ──

class PatientAccessLogOut(BaseModel):
    id: int
    patient_id: int
    requesting_org_id: int
    organization_name: Optional[str] = None
    use_type: UseType = UseType.primary_care
    secondary_purpose: Optional[SecondaryPurpose] = None
    scopes: Optional[str] = None
    status: AccessRequestStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None
    token_id: Optional[int] = None
    model_config = {"from_attributes": True}


# ── Destination Directory ──

class DestinationOut(BaseModel):
    id: int
    name: str
    kind: DestinationKind
    preferred_contact_method: Optional[str] = "api_stub"
    endpoint_url: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Fulfillment ──

class FulfillmentTaskOut(BaseModel):
    id: int
    packet_id: int
    type: FulfillmentTaskType
    destination_type: FulfillmentTaskDestType
    destination_id: Optional[int] = None
    payload_json: Optional[dict] = None
    status: FulfillmentTaskStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_error: Optional[str] = None
    destination: Optional[DestinationOut] = None
    model_config = {"from_attributes": True}


class FulfillmentPacketOut(BaseModel):
    id: int
    patient_id: int
    organization_id: Optional[int] = None
    encounter_id: Optional[int] = None
    source_note_id: Optional[int] = None
    status: FulfillmentPacketStatus
    items_json: Optional[dict] = None
    created_at: datetime
    tasks: list[FulfillmentTaskOut] = []
    model_config = {"from_attributes": True}


class FulfillmentPacketCreate(BaseModel):
    encounter_id: Optional[int] = None
    note_id: Optional[int] = None
    organization_id: Optional[int] = None


class FulfillmentPreferencesOut(BaseModel):
    id: int
    patient_id: int
    preferred_lab_id: Optional[int] = None
    preferred_pharmacy_id: Optional[int] = None
    preferred_primary_care_office_id: Optional[int] = None
    preferred_payer_id: Optional[int] = None
    preferred_specialist_office_ids: Optional[list[int]] = None
    model_config = {"from_attributes": True}


class FulfillmentPreferencesUpdate(BaseModel):
    preferred_lab_id: Optional[int] = None
    preferred_pharmacy_id: Optional[int] = None
    preferred_primary_care_office_id: Optional[int] = None
    preferred_payer_id: Optional[int] = None
    preferred_specialist_office_ids: Optional[list[int]] = None


# ── Order Workflow (MVP mediator loop) ──

class OrderDraftCreate(BaseModel):
    patient_id: int
    organization_id: int
    order_type: OrderType
    title: str
    description: Optional[str] = None
    drug_name: Optional[str] = None
    drug_dosage: Optional[str] = None
    drug_frequency: Optional[str] = None
    drug_class: Optional[str] = None
    lab_test_code: Optional[str] = None
    lab_test_name: Optional[str] = None
    icd_codes: Optional[str] = None
    payer_type: Optional[str] = None
    destination_pharmacy_id: Optional[int] = None
    destination_lab_id: Optional[int] = None
    created_by: Optional[str] = None


class OrderDraftUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    drug_name: Optional[str] = None
    drug_dosage: Optional[str] = None
    drug_frequency: Optional[str] = None
    drug_class: Optional[str] = None
    lab_test_code: Optional[str] = None
    lab_test_name: Optional[str] = None
    icd_codes: Optional[str] = None
    payer_type: Optional[str] = None
    destination_pharmacy_id: Optional[int] = None
    destination_lab_id: Optional[int] = None


class PatientActionCreate(BaseModel):
    action_type: PatientActionType
    allow_generic_substitution: Optional[bool] = None
    max_out_of_pocket: Optional[float] = None
    preferred_pharmacy_id: Optional[int] = None
    preferred_lab_id: Optional[int] = None
    require_callback_before_changes: bool = False
    additional_constraints: Optional[dict] = None
    comment: Optional[str] = None


class PatientActionOut(BaseModel):
    id: int
    order_draft_id: int
    patient_id: int
    action_type: PatientActionType
    allow_generic_substitution: Optional[bool] = None
    max_out_of_pocket: Optional[float] = None
    preferred_pharmacy_id: Optional[int] = None
    preferred_lab_id: Optional[int] = None
    require_callback_before_changes: bool = False
    additional_constraints: Optional[dict] = None
    comment: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class OrderDraftOut(BaseModel):
    id: int
    patient_id: int
    organization_id: int
    order_type: OrderType
    status: OrderDraftStatus
    title: str
    description: Optional[str] = None
    drug_name: Optional[str] = None
    drug_dosage: Optional[str] = None
    drug_frequency: Optional[str] = None
    drug_class: Optional[str] = None
    lab_test_code: Optional[str] = None
    lab_test_name: Optional[str] = None
    icd_codes: Optional[str] = None
    prior_auth_likely: PriorAuthLikelihood = PriorAuthLikelihood.unknown
    payer_type: Optional[str] = None
    patient_constraints: Optional[dict] = None
    destination_pharmacy_id: Optional[int] = None
    destination_lab_id: Optional[int] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None
    actions: list[PatientActionOut] = []
    organization: Optional[OrganizationOut] = None
    model_config = {"from_attributes": True}


class OrderStatusTransition(BaseModel):
    new_status: OrderDraftStatus


# ── Clinician management ──

class ClinicianBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    npi: Optional[str] = None
    credential: Optional[str] = None
    specialty: Optional[str] = None
    role: ClinicianRole = ClinicianRole.physician
    organization_id: Optional[int] = None


class ClinicianCreate(ClinicianBase):
    password: Optional[str] = None
    status: ClinicianStatus = ClinicianStatus.active


class ClinicianUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    npi: Optional[str] = None
    credential: Optional[str] = None
    specialty: Optional[str] = None
    role: Optional[ClinicianRole] = None
    status: Optional[ClinicianStatus] = None
    organization_id: Optional[int] = None
    password: Optional[str] = None


class ClinicianOut(BaseModel):
    id: int
    npi: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    credential: Optional[str] = None
    specialty: Optional[str] = None
    role: ClinicianRole
    status: ClinicianStatus
    organization_id: Optional[int] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    organization: Optional[OrganizationOut] = None
    actor_name: Optional[str] = None
    model_config = {"from_attributes": True}


class ClinicianLogin(BaseModel):
    email: str
    password: str


class ClinicianLoginOut(BaseModel):
    token: str
    clinician: ClinicianOut


# ── Patient feedback (the patient's voice → CDS) ──

class PatientFeedbackCreate(BaseModel):
    topic: Optional[str] = None
    target_kind: Optional[str] = None
    target_ref: Optional[str] = None
    target_label: Optional[str] = None
    sentiment: FeedbackSentiment = FeedbackSentiment.concern
    message: str


class PatientFeedbackUpdate(BaseModel):
    status: Optional[FeedbackStatus] = None
    acknowledged_by: Optional[str] = None


class PatientFeedbackOut(BaseModel):
    id: int
    patient_id: int
    topic: Optional[str] = None
    target_kind: Optional[str] = None
    target_ref: Optional[str] = None
    target_label: Optional[str] = None
    sentiment: FeedbackSentiment
    message: str
    status: FeedbackStatus
    acknowledged_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
