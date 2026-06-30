export type EhrVendor = 'epic' | 'cerner' | 'meditech' | 'other'

export interface Organization {
  id: number
  name: string
  type: string | null
  contact_email: string | null
  ehr_system_name: string | null
  client_id: string | null
  redirect_uri: string | null
  fhir_base_url: string | null
  ehr_vendor: EhrVendor | null
  smart_discovery_mode: string | null
  fhir_profile: string | null
}

export interface EhrAdapterInfo {
  org_id: number
  org_name: string
  ehr_vendor: EhrVendor | null
  fhir_base_url: string | null
  fhir_profile: string | null
  smart_discovery_mode: string | null
  authorization_endpoint: string
  token_endpoint: string
  introspection_endpoint: string
  scopes_supported: string[]
  capabilities: string[]
  supported_resources: string[]
}

export interface Patient {
  id: number
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export interface ClinicalNote {
  id: number
  patient_id: number
  author: string
  date: string
  content: string
  status: 'pending_review' | 'approved' | 'flagged'
  patient_comments: string | null
}

export interface Diagnosis {
  id: number
  patient_id: number
  code: string | null
  description: string
  date_diagnosed: string | null
  status: string | null
}

export interface Medication {
  id: number
  patient_id: number
  name: string
  dosage: string | null
  frequency: string | null
  prescriber: string | null
  start_date: string | null
  end_date: string | null
}

export interface Allergy {
  id: number
  patient_id: number
  allergen: string
  reaction: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
}

export interface LabResult {
  id: number
  patient_id: number
  test_name: string
  value: string | null
  unit: string | null
  reference_range: string | null
  date: string
  status: string | null
}

export interface Encounter {
  id: number
  patient_id: number
  date: string
  provider: string | null
  location: string | null
  type: string | null
  summary: string | null
}

export type UseType = 'primary_care' | 'secondary_use'
export type SecondaryPurpose = 'research' | 'quality_improvement' | 'public_health' | 'operations_analytics' | 'care_pattern_comparison'

export interface AccessRequest {
  id: number
  patient_id: number
  requesting_org_id: number
  purpose: string | null
  status: 'pending' | 'approved' | 'denied'
  scopes: string | null
  use_type: UseType
  secondary_purpose: SecondaryPurpose | null
  approved_time_window: string | null
  approved_duration: string | null
  approved_categories: string | null
  created_at: string
  resolved_at: string | null
  organization: Organization | null
}

export interface Payment {
  id: number
  access_request_id: number
  amount: number
  status: 'pending' | 'completed' | 'failed'
  created_at: string
}

export interface Notification {
  id: number
  patient_id: number
  type: string
  message: string
  read: boolean
  created_at: string
  access_request_id: number | null
}

export interface AccessLog {
  id: number
  patient_id: number
  requesting_org_id: number | null
  action: string
  timestamp: string
  details: string | null
}

export interface PatientRecords {
  patient: Patient
  clinical_notes: ClinicalNote[]
  diagnoses: Diagnosis[]
  medications: Medication[]
  allergies: Allergy[]
  lab_results: LabResult[]
  encounters: Encounter[]
}

export interface ConsentSession {
  id: number
  session_token: string
  patient_id: number
  organization_id: number
  status: 'initiated' | 'pending_patient' | 'approved' | 'denied' | 'expired'
  scopes_requested: string | null
  purpose: string | null
  launch_method: string | null
  created_at: string
  expires_at: string | null
  resolved_at: string | null
  ai_summary: string | null
}

export interface WsMessage {
  type: string
  message: string
  session_id?: number | null
  access_request_id?: number | null
  use_type?: string | null
  secondary_purpose?: string | null
  data?: Record<string, any> | null
}

export interface NoteReview {
  id: number
  note_id: number
  patient_id: number
  status: 'approved' | 'flagged'
  comment: string | null
  created_at: string
}

export interface PatientAccessLog {
  id: number
  patient_id: number
  requesting_org_id: number
  organization_name: string | null
  use_type: UseType
  secondary_purpose: SecondaryPurpose | null
  scopes: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  resolved_at: string | null
  token_id: number | null
}

export interface NoteTranslation {
  plain_language: string
  key_points: string[]
}

export interface NoteVerification {
  checklist: string[]
  common_errors: string[]
}

// ── Fulfillment Routing ──

export type DestinationKind = 'lab' | 'pharmacy' | 'provider' | 'payer'

export interface Destination {
  id: number
  name: string
  kind: DestinationKind
  preferred_contact_method: string | null
  endpoint_url: string | null
  phone: string | null
  fax: string | null
  email: string | null
  address: string | null
}

export type FulfillmentTaskType = 'lab_order' | 'pharmacy_rx' | 'referral' | 'insurance_packet' | 'record_request'
export type FulfillmentTaskStatus = 'queued' | 'sent' | 'acknowledged' | 'completed' | 'failed' | 'needs_patient_input'
export type FulfillmentPacketStatus = 'created' | 'in_progress' | 'completed' | 'blocked'

export interface FulfillmentTask {
  id: number
  packet_id: number
  type: FulfillmentTaskType
  destination_type: DestinationKind
  destination_id: number | null
  payload_json: Record<string, any> | null
  status: FulfillmentTaskStatus
  created_at: string
  updated_at: string | null
  last_error: string | null
  destination: Destination | null
}

export interface FulfillmentPacket {
  id: number
  patient_id: number
  organization_id: number | null
  encounter_id: number | null
  source_note_id: number | null
  status: FulfillmentPacketStatus
  items_json: Record<string, any> | null
  created_at: string
  tasks: FulfillmentTask[]
}

export interface FulfillmentPreferences {
  id: number
  patient_id: number
  preferred_lab_id: number | null
  preferred_pharmacy_id: number | null
  preferred_primary_care_office_id: number | null
  preferred_payer_id: number | null
  preferred_specialist_office_ids: number[] | null
}

export interface FulfillmentSummary {
  checklist: string[]
  what_to_expect: string[]
  patient_actions: string[]
}

// ── Order Workflow (MVP mediator loop) ──

export type OrderDraftStatus =
  | 'drafted'
  | 'awaiting_patient'
  | 'patient_approved'
  | 'patient_requested_change'
  | 'ready_to_submit'
  | 'submitted'
  | 'fulfilled'
  | 'failed'
  | 'cancelled'

export type OrderType = 'medication' | 'lab_order' | 'referral' | 'prior_auth' | 'imaging'
export type PatientActionType = 'approve' | 'approve_with_limits' | 'request_change' | 'reject'
export type PriorAuthLikelihood = 'yes' | 'no' | 'unknown'

export interface PatientAction {
  id: number
  order_draft_id: number
  patient_id: number
  action_type: PatientActionType
  allow_generic_substitution: boolean | null
  max_out_of_pocket: number | null
  preferred_pharmacy_id: number | null
  preferred_lab_id: number | null
  require_callback_before_changes: boolean
  additional_constraints: Record<string, unknown> | null
  comment: string | null
  created_at: string
}

export interface OrderDraft {
  id: number
  patient_id: number
  organization_id: number
  order_type: OrderType
  status: OrderDraftStatus
  title: string
  description: string | null
  drug_name: string | null
  drug_dosage: string | null
  drug_frequency: string | null
  drug_class: string | null
  lab_test_code: string | null
  lab_test_name: string | null
  icd_codes: string | null
  prior_auth_likely: PriorAuthLikelihood
  payer_type: string | null
  patient_constraints: Record<string, unknown> | null
  destination_pharmacy_id: number | null
  destination_lab_id: number | null
  created_by: string | null
  created_at: string
  updated_at: string | null
  submitted_at: string | null
  fulfilled_at: string | null
  actions: PatientAction[]
  organization: Organization | null
}

export interface OrderTimeline {
  order_id: number
  current_status: OrderDraftStatus
  timeline: { timestamp: string; action: string; details: string }[]
}
