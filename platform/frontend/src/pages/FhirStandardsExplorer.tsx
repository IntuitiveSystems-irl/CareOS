import { useState } from 'react'
import { Link } from 'react-router-dom'
import InquireModal from '../components/InquireModal'
import {
  Network, ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  Circle, ExternalLink, Search, Shield, BookOpen, Zap, Database,
  Lock, Activity, FileText, ArrowUpRight, Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Coverage = 'live' | 'partial' | 'scaffolded' | 'none'
type Verb = 'SHALL' | 'SHOULD' | 'MAY' | 'SHALL-NOT'

interface Req {
  verb: Verb
  text: string
  careosNote?: string
  met: boolean | 'partial'
}

interface StandardNode {
  id: string
  label: string
  subtitle: string
  icon?: any
  coverage: Coverage
  source?: string
  summary: string
  reqs?: Req[]
  endpoints?: string[]
  children?: StandardNode[]
}

// ── Data — complete US Core + FHIR module map for CareOS ────────────────────

const STANDARDS: StandardNode[] = [
  {
    id: 'smart',
    label: 'SMART on FHIR',
    subtitle: 'Authorization & Launch Framework',
    icon: Lock,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/scopes.html',
    summary: 'OAuth 2.0 authorization framework for FHIR apps. CareOS implements the full SMART on FHIR authorization server including standalone launch, EHR launch, PKCE, token introspection, and JWKS publication.',
    endpoints: [
      'GET /.well-known/smart-configuration',
      'GET /.well-known/jwks.json',
      'GET /auth/authorize',
      'POST /auth/token',
      'POST /auth/introspect',
    ],
    reqs: [
      { verb: 'SHALL', text: 'Publish SMART configuration JSON at /.well-known/smart-configuration', met: true, careosNote: 'smart_auth.py → /well-known/smart-configuration with issuer, jwks_uri, endpoints, capabilities, scopes_supported' },
      { verb: 'SHALL', text: 'Include jwks_uri in SMART configuration', met: true, careosNote: '/.well-known/jwks.json served via epic_backend router' },
      { verb: 'SHALL', text: 'Support token introspection endpoint', met: true, careosNote: 'POST /auth/introspect validates JWT and returns active/inactive + claims' },
      { verb: 'SHALL', text: 'Support code_challenge_methods_supported: [S256]', met: true, careosNote: 'Advertised in .well-known; PKCE enforced on authorize flow' },
      { verb: 'SHALL', text: 'Support authorization_code grant', met: true, careosNote: 'GET /auth/authorize → POST /auth/token code exchange' },
      { verb: 'SHOULD', text: 'Support EHR launch context (launch/patient)', met: true, careosNote: 'launch/patient scope + context-ehr-patient capability advertised' },
      { verb: 'SHALL', text: 'List required US Core scopes in scopes_supported', met: true, careosNote: '21 scopes including patient/*.read, system/*.read, launch, openid, fhirUser, offline_access' },
      { verb: 'SHALL', text: 'Support backend service client-confidential-asymmetric', met: true, careosNote: 'SMART Backend Services JWT flow via epic_backend router + JWKS' },
    ],
    children: [
      {
        id: 'smart-scopes',
        label: 'Granular Scopes',
        subtitle: 'US Core STU 9 — resource + category scopes',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/scopes.html#granular-scopes-for-requesting-fhir-resources',
        summary: 'US Core requires granular category-based scopes for Condition and Observation. CareOS advertises all required granular scopes and the endpoints support category= filtering.',
        endpoints: ['GET /fhir/Condition?category=problem-list-item', 'GET /fhir/Observation?category=laboratory'],
        reqs: [
          { verb: 'SHALL', text: 'Support Condition category granular scopes: problem-list-item, encounter-diagnosis, health-concern', met: true, careosNote: 'GET /fhir/Condition?category= filter implemented; scopes in .well-known' },
          { verb: 'SHALL', text: 'Support Observation category granular scopes: laboratory, vital-signs, social-history, survey, sdoh', met: true, careosNote: 'GET /fhir/Observation?category= filter; each Observation carries category coding' },
          { verb: 'SHOULD', text: 'Support DocumentReference clinical-note granular scope', met: 'partial', careosNote: 'DocumentReference listed in CapabilityStatement via EHR adapters; native endpoint coming' },
        ],
      },
      {
        id: 'smart-caps',
        label: 'Capability Sets',
        subtitle: 'Patient Access + Clinician Access + Backend Services',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/scopes.html#capability-sets-for-us-core-servers',
        summary: 'CareOS supports all three SMART capability sets. Patient standalone app launch, EHR-integrated clinician launch, and system-level backend services.',
        reqs: [
          { verb: 'SHOULD', text: 'Support Patient Access for Standalone Apps capability set', met: true, careosNote: 'launch-standalone + client-public + context-standalone-patient' },
          { verb: 'SHOULD', text: 'Support Clinician Access for EHR Launch capability set', met: true, careosNote: 'launch-ehr + context-ehr-patient + permission-user' },
          { verb: 'SHALL', text: 'Support Backend Services: client-confidential-asymmetric + system/ scopes', met: true, careosNote: 'SMART Backend Services JWT flow; system/*.read advertised' },
        ],
      },
    ],
  },
  {
    id: 'capability',
    label: 'CapabilityStatement',
    subtitle: 'FHIR R4 Server Conformance Declaration',
    icon: BookOpen,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/capability-statements.html',
    summary: 'The server\'s self-description of all supported resources, interactions, search parameters, and SMART capabilities. CareOS publishes a full R4 CapabilityStatement at GET /fhir/metadata.',
    endpoints: ['GET /fhir/metadata'],
    reqs: [
      { verb: 'SHALL', text: 'Publish CapabilityStatement at /fhir/metadata', met: true, careosNote: 'Full R4 CapabilityStatement with 14 resource types, US Core profiles, and operations' },
      { verb: 'SHOULD', text: 'Include instantiates referencing US Core Server CapabilityStatement URL', met: true, careosNote: 'instantiates: ["http://hl7.org/fhir/us/core/CapabilityStatement/us-core-server"]' },
      { verb: 'SHALL', text: 'Declare supportedProfile canonical URLs per resource', met: true, careosNote: 'All 6 core resources carry US Core STU 9 profile URLs' },
      { verb: 'SHALL', text: 'Declare RESTful transactions (read, search-type) per resource', met: true, careosNote: 'Every resource entry has read + search-type interactions' },
      { verb: 'SHALL', text: 'Advertise SMART OAuth URIs via security extension', met: true, careosNote: 'fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris extension present' },
      { verb: 'MAY', text: 'Advertise implementationGuide canonical', met: true, careosNote: 'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core listed' },
    ],
  },
  {
    id: 'resources',
    label: 'FHIR R4 Resources',
    subtitle: 'US Core Profiles — Clinical Data',
    icon: Database,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/profiles-and-extensions.html',
    summary: 'CareOS serves 14 FHIR resource types across clinical, administrative, safety, consent, and research domains. All core clinical resources follow US Core STU 9 profiles with Must Support elements, proper status coding, and DataAbsentReason for missing data.',
    children: [
      {
        id: 'res-patient',
        label: 'Patient',
        subtitle: 'US Core Patient Profile',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-patient.html',
        summary: 'Demographics including name, gender, birthDate, telecom, and address. Read + search by patient id.',
        endpoints: ['GET /fhir/Patient/{id}'],
        reqs: [
          { verb: 'SHALL', text: 'Populate name, identifier (or DataAbsentReason)', met: true, careosNote: 'family + given name always present' },
          { verb: 'SHALL', text: 'Populate gender', met: true, careosNote: 'Defaults to "unknown" when absent (US Core allowed)' },
          { verb: 'SHALL', text: 'Return 404 OperationOutcome when not found', met: true, careosNote: '_operation_outcome("warning","not-found") on 404' },
        ],
      },
      {
        id: 'res-condition',
        label: 'Condition',
        subtitle: 'US Core Condition Problems & Health Concerns',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-condition-problems-health-concerns.html',
        summary: 'Problem list with ICD-10 coding, clinical/verification status, and category. Supports GET and POST $search with granular category filter.',
        endpoints: ['GET /fhir/Condition?patient=', 'POST /fhir/Condition/_search'],
        reqs: [
          { verb: 'SHALL', text: 'Include clinicalStatus (required binding)', met: true, careosNote: 'condition-clinical CodeSystem coding present on every resource' },
          { verb: 'SHALL', text: 'Include verificationStatus', met: true, careosNote: '"confirmed" from condition-ver-status CodeSystem' },
          { verb: 'SHALL', text: 'Include category (problem-list-item or encounter-diagnosis)', met: true, careosNote: 'category.coding from condition-category CodeSystem' },
          { verb: 'SHALL', text: 'Support POST-based search', met: true, careosNote: 'POST /fhir/Condition/_search delegates to GET handler' },
          { verb: 'SHALL', text: 'Use DataAbsentReason for missing coded data', met: true, careosNote: '_DATA_ABSENT extension applied when code is absent' },
        ],
      },
      {
        id: 'res-med',
        label: 'MedicationRequest',
        subtitle: 'US Core MedicationRequest Profile',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-medicationrequest.html',
        summary: 'Medication orders with status, intent, dosage, prescriber, and authored date. Status filter + POST $search.',
        endpoints: ['GET /fhir/MedicationRequest?patient=', 'POST /fhir/MedicationRequest/_search'],
        reqs: [
          { verb: 'SHALL', text: 'Include status (required binding)', met: true, careosNote: 'status field populated; defaults to "active"' },
          { verb: 'SHALL', text: 'Include intent (required binding)', met: true, careosNote: '"order" hardcoded per US Core profile' },
          { verb: 'SHALL', text: 'Support POST-based search', met: true, careosNote: 'POST /fhir/MedicationRequest/_search' },
        ],
      },
      {
        id: 'res-allergy',
        label: 'AllergyIntolerance',
        subtitle: 'US Core AllergyIntolerance Profile',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-allergyintolerance.html',
        summary: 'Allergy records with substance, criticality, and reaction manifestation. Criticality mapped from internal severity enum.',
        endpoints: ['GET /fhir/AllergyIntolerance?patient='],
        reqs: [
          { verb: 'SHALL', text: 'Include code (substance)', met: true, careosNote: 'CodeableConcept.text from allergen field' },
          { verb: 'SHALL', text: 'Include criticality when present', met: true, careosNote: 'Mapped: mild/moderate→low, severe→high; else unable-to-assess' },
        ],
      },
      {
        id: 'res-obs',
        label: 'Observation',
        subtitle: 'US Core Laboratory Result + Observation Profiles',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-observation-lab.html',
        summary: 'Lab results with status, US Core category coding, LOINC code, value quantity, reference range, and effective date. Supports granular category filter and POST $search.',
        endpoints: ['GET /fhir/Observation?patient=', 'POST /fhir/Observation/_search', 'GET /fhir/Observation?patient=&category=laboratory'],
        reqs: [
          { verb: 'SHALL', text: 'Include status (required binding)', met: true, careosNote: 'Defaults to "final"' },
          { verb: 'SHALL', text: 'Include category with observation-category coding', met: true, careosNote: '"laboratory" from observation-category CodeSystem' },
          { verb: 'SHALL', text: 'Support POST-based search', met: true, careosNote: 'POST /fhir/Observation/_search' },
          { verb: 'SHALL', text: 'Use DataAbsentReason when code missing', met: true, careosNote: '_DATA_ABSENT applied when test_name is None' },
        ],
      },
      {
        id: 'res-encounter',
        label: 'Encounter',
        subtitle: 'US Core Encounter Profile',
        coverage: 'live',
        source: 'https://hl7.org/fhir/us/core/StructureDefinition-us-core-encounter.html',
        summary: 'Encounter records with period, participant, location, type, and reason.',
        endpoints: ['GET /fhir/Encounter?patient='],
        reqs: [
          { verb: 'SHALL', text: 'Include status', met: 'partial', careosNote: 'Type and period present; explicit status field not in current Encounter model — defaulting to "finished"' },
          { verb: 'SHALL', text: 'Include class', met: 'partial', careosNote: 'Not yet populated — encounter.type used as label' },
        ],
      },
      {
        id: 'res-audit',
        label: 'AuditEvent',
        subtitle: 'FHIR R4 AuditEvent — Tamper-Evident Chain',
        coverage: 'live',
        source: 'https://www.hl7.org/fhir/auditevent.html',
        summary: 'CareOS\'s SHA-256 hash-chained audit log exposed as FHIR AuditEvent resources. Every PHI read/write, HL7 receive, transform, route, and delivery event is recorded. Hash chain values are embedded as extensions for verifiability.',
        endpoints: ['GET /fhir/AuditEvent', 'GET /fhir/AuditEvent/{id}'],
        reqs: [
          { verb: 'SHALL', text: 'Keep audit logs of transactions (HIPAA §164.312(b))', met: true, careosNote: 'SHA-256 hash chain; every event linked to previous hash; verify at /api/relay/audit/verify' },
          { verb: 'SHALL', text: 'Return AuditEvent with type, action, recorded, agent, source', met: true, careosNote: 'All fields populated; DICOM action codes (R/C/E)' },
          { verb: 'SHALL', text: 'Reference a single time source', met: true, careosNote: 'datetime.utcnow() throughout; consistent UTC timestamps' },
        ],
      },
      {
        id: 'res-consent',
        label: 'Consent',
        subtitle: 'FHIR R4 Consent — SMART on FHIR Patient Authorization',
        coverage: 'live',
        source: 'https://www.hl7.org/fhir/consent.html',
        summary: 'Each SMART on FHIR ConsentSession serialized as a FHIR Consent resource with scope, category (LOINC 59284-0), provision (permit/deny), period, and CareOS extensions for session token and launch method.',
        endpoints: ['GET /fhir/Consent?patient='],
        reqs: [
          { verb: 'SHALL', text: 'Include status, scope, category, patient', met: true, careosNote: 'All required fields; status mapped from ConsentSessionStatus enum' },
          { verb: 'SHALL', text: 'Include provision type (permit/deny)', met: true, careosNote: 'permit when approved, deny otherwise' },
        ],
      },
      {
        id: 'res-task',
        label: 'Task',
        subtitle: 'FHIR R4 Task — Fulfillment Routing',
        coverage: 'live',
        source: 'https://www.hl7.org/fhir/task.html',
        summary: 'FulfillmentTasks (lab orders, pharmacy Rx, referrals, prior auth, record requests) wrapped as FHIR Task resources with SNOMED codes, full status lifecycle, payload as input[], and CareOS extension for destination metadata.',
        endpoints: ['GET /fhir/Task?patient=', 'GET /fhir/Task?patient=&status=requested'],
        reqs: [
          { verb: 'SHALL', text: 'Include status, intent, code', met: true, careosNote: 'Status mapped from FulfillmentTaskStatus; intent="order"; SNOMED code per task type' },
          { verb: 'SHALL', text: 'Include for (patient reference)', met: true, careosNote: 'Patient/{id} reference via packet.patient_id' },
        ],
      },
      {
        id: 'res-detected',
        label: 'DetectedIssue',
        subtitle: 'FHIR R4 DetectedIssue — Allergy-Medication Conflicts',
        coverage: 'live',
        source: 'https://www.hl7.org/fhir/detectedissue.html',
        summary: 'Drug-allergy conflicts detected by the CareOS relational safety engine returned as FHIR DetectedIssue resources. Each issue cites the MedicationRequest and AllergyIntolerance that conflict, with v3-ActCode ALG/DINT codes.',
        endpoints: ['GET /fhir/DetectedIssue?patient='],
        reqs: [
          { verb: 'SHALL', text: 'Include status, code, severity, patient', met: true, careosNote: 'All fields; severity="high" for allergy conflicts' },
          { verb: 'SHALL', text: 'Include implicated references', met: true, careosNote: 'MedicationRequest/{id} and AllergyIntolerance/{id}' },
        ],
      },
      {
        id: 'res-research',
        label: 'ResearchStudy / ResearchSubject',
        subtitle: 'FHIR R4 Research Resources — EHR Usability Study',
        coverage: 'live',
        source: 'https://www.hl7.org/fhir/researchstudy.html',
        summary: 'CareOS\'s comparative EHR usability study (convergent mixed-methods, within-subjects crossover) exposed as FHIR ResearchStudy + ResearchSubject resources. Participants anonymized to participant_code only.',
        endpoints: ['GET /fhir/ResearchStudy', 'GET /fhir/ResearchSubject'],
        reqs: [
          { verb: 'SHALL', text: 'Include status, title, arm descriptions', met: true, careosNote: 'status="active"; two arms: Traditional EHR + Relational EHR' },
          { verb: 'SHALL', text: 'Anonymize participant identifiers', met: true, careosNote: 'Only participant_code in individual.identifier; no name/email' },
        ],
      },
    ],
  },
  {
    id: 'operationoutcome',
    label: 'OperationOutcome',
    subtitle: 'FHIR Error Responses — US Core Missing Data Rules',
    icon: AlertCircle,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/general-requirements.html#missing-data',
    summary: 'All /fhir/* error responses return application/fhir+json OperationOutcome with severity, code, and details. Validation errors (422), auth failures (401/403), payment required (402), not found (404), and server errors (500) all produce proper FHIR-typed responses.',
    endpoints: ['All /fhir/* routes on error'],
    reqs: [
      { verb: 'SHALL', text: 'Return 404 + OperationOutcome when resource not found', met: true, careosNote: '_operation_outcome("warning","not-found") on all 404s' },
      { verb: 'SHALL', text: 'Return OperationOutcome specifying required status(es) when status missing', met: true, careosNote: 'HTTPException detail is always an OperationOutcome dict' },
      { verb: 'SHALL', text: 'Use DataAbsentReason for missing mandatory coded data', met: true, careosNote: '_DATA_ABSENT = data-absent-reason extension with valueCode:"unknown"' },
      { verb: 'SHOULD', text: 'Include OperationOutcome warning for suppressed non-conformant resources', met: 'partial', careosNote: 'OperationOutcome present on errors; bundle-level suppression warnings coming' },
    ],
  },
  {
    id: 'search',
    label: 'RESTful Search API',
    subtitle: 'US Core Search Requirements',
    icon: Search,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/general-requirements.html#fhir-restful-search-api-requirements',
    summary: 'CareOS supports GET and POST search across all clinical resources. Token, reference, and date search parameters follow US Core precision rules.',
    reqs: [
      { verb: 'SHALL', text: 'Support HTTP GET-based search for all supported interactions', met: true, careosNote: 'All resources have GET ?patient= search' },
      { verb: 'SHALL', text: 'Support HTTP POST-based search', met: true, careosNote: 'Condition/_search, MedicationRequest/_search, Observation/_search' },
      { verb: 'SHALL', text: 'Support token searches with code and system+code', met: true, careosNote: 'patient= param is token reference; status= is token' },
      { verb: 'SHALL', text: 'Support date searches at day precision for date, second+offset for dateTime', met: 'partial', careosNote: 'Dates returned as ISO-8601; range filter not yet implemented' },
      { verb: 'SHOULD', text: 'Support resource queries without requiring status parameter', met: true, careosNote: 'Status is always optional; missing status never returns 400' },
    ],
  },
  {
    id: 'bulk',
    label: 'Bulk Data / USCDI v3',
    subtitle: 'SMART Bulk Data IG v2 + ONC USCDI v3 Export',
    icon: Zap,
    coverage: 'live',
    source: 'http://hl7.org/fhir/uv/bulkdata/',
    summary: 'CareOS implements async NDJSON Bulk Data export (kickoff → status polling → download) and a single-call USCDI v3 patient Bundle export covering all 27 USCDI v3 data classes.',
    endpoints: [
      'POST /api/careos/$export',
      'GET /api/careos/$export-status/{job_id}',
      'GET /api/careos/$export-files/{job_id}/{resource_type}',
      'GET /api/careos/patients/{external_id}/uscdi',
    ],
    reqs: [
      { verb: 'SHALL', text: 'Kickoff request returns 202 Accepted with Content-Location header', met: true, careosNote: 'POST /$export → 202 with polling URL' },
      { verb: 'SHALL', text: 'Status endpoint returns 202 while in progress, 200 with output manifest when done', met: true, careosNote: 'GET /$export-status returns progress or final NDJSON manifest' },
      { verb: 'SHALL', text: 'Output NDJSON with one resource per line', met: true, careosNote: 'NDJSON files written per resource type' },
      { verb: 'SHALL', text: 'Support _type parameter for resource type filtering', met: true, careosNote: '_type query param filters NDJSON output' },
    ],
  },
  {
    id: 'cds',
    label: 'CDS Hooks',
    subtitle: 'HL7 CDS Hooks 1.0 — Outbound Decision Support',
    icon: Activity,
    coverage: 'live',
    source: 'https://cds-hooks.org/',
    summary: 'CareOS implements CDS Hooks 1.0 as an outbound decision support service. Two services are live: careos-patient-summary (patient-view hook) and careos-medication-safety (order-select / order-sign hooks). Cards are deterministic — no LLM. Every invocation is audited.',
    endpoints: [
      'GET /cds-services',
      'POST /cds-services/careos-patient-summary',
      'POST /cds-services/careos-medication-safety',
    ],
    reqs: [
      { verb: 'SHALL', text: 'Publish discovery document at GET /cds-services', met: true, careosNote: 'Returns services array with id, title, description, hook, prefetch' },
      { verb: 'SHALL', text: 'Return cards array on POST /cds-services/{id}', met: true, careosNote: 'Cards with summary, indicator, source, links returned' },
      { verb: 'SHOULD', text: 'Support prefetch population from FHIR canonical store', met: true, careosNote: 'Patient chart resolved from canonical store on invoke' },
      { verb: 'SHALL', text: 'Audit every invocation', met: true, careosNote: '_audit_invoke records phi_read action in tamper-evident audit chain' },
    ],
  },
  {
    id: 'security',
    label: 'Security & HIPAA',
    subtitle: 'US Core Security + HIPAA §164.312 Controls',
    icon: Shield,
    coverage: 'live',
    source: 'https://hl7.org/fhir/us/core/security.html',
    summary: 'CareOS implements all US Core security requirements: TLS, audit logging, HIPAA risk controls, AES-256-GCM encryption at rest, and SMART on FHIR access control. The audit chain is verifiable at /api/relay/audit/verify.',
    endpoints: [
      'GET /api/relay/audit/verify',
      'POST /auth/introspect',
      'GET /.well-known/jwks.json',
    ],
    reqs: [
      { verb: 'SHALL', text: 'Use TLS 1.2+ for all transmissions', met: true, careosNote: 'TLS enforced at nginx; HTTPS-only via Cloudflare' },
      { verb: 'SHALL', text: 'Keep audit logs of transactions', met: true, careosNote: 'SHA-256 hash-chained AuditEntry table; every PHI event logged' },
      { verb: 'SHALL', text: 'Establish HIPAA risk analysis and management', met: true, careosNote: 'SECURITY_POLICY.md + COMPLIANCE_MATRIX.md; data classification L1/L2/L3' },
      { verb: 'SHALL', text: 'Limit access to authorized individuals (SMART Bearer token)', met: true, careosNote: 'JWT validation on all /fhir/* routes; patient-specific access only' },
      { verb: 'SHALL', text: 'Protect data in transit and at rest', met: true, careosNote: 'AES-256-GCM envelope encryption per record; TLS in transit' },
      { verb: 'SHALL', text: 'Conform to FHIR Communications Security requirements', met: true, careosNote: 'CORS, HSTS, hardened headers; security response headers via nginx' },
      { verb: 'SHOULD', text: 'Reference a single time source for audit records', met: true, careosNote: 'datetime.utcnow() consistent across all audit entries' },
    ],
  },
  {
    id: 'hl7v2',
    label: 'HL7 v2 → FHIR Transform',
    subtitle: 'HL7 v2.5 MLLP Ingest + R4 Resource Mapping',
    icon: FileText,
    coverage: 'live',
    source: 'https://www.hl7.org/fhir/mapping-language.html',
    summary: 'CareOS listens on port 2575 for HL7 v2.5 MLLP messages and transforms PID, PV1, OBX, DG1, RXA, AL1 segments into FHIR R4 Patient, Encounter, Observation, Condition, AllergyIntolerance, and Immunization resources assembled into a FHIR Bundle.',
    reqs: [
      { verb: 'SHALL', text: 'Map PID → FHIR Patient (name, MRN, DOB, gender, address, telecom)', met: true, careosNote: 'map_pid_to_patient() in hl7v2_to_fhir.py' },
      { verb: 'SHALL', text: 'Map PV1 → FHIR Encounter', met: true, careosNote: 'map_pv1_to_encounter()' },
      { verb: 'SHALL', text: 'Map OBX → FHIR Observation', met: true, careosNote: 'map_obx_to_observation()' },
      { verb: 'SHALL', text: 'Map DG1 → FHIR Condition', met: true, careosNote: 'map_dg1_to_condition()' },
      { verb: 'SHALL', text: 'Map AL1 → FHIR AllergyIntolerance', met: true, careosNote: 'map_al1_to_allergy()' },
      { verb: 'SHALL', text: 'Assemble into FHIR Bundle (transaction type)', met: true, careosNote: 'hl7_to_fhir_bundle() → Bundle with all resources' },
    ],
  },
]

// ── Coverage badge ───────────────────────────────────────────────────────────

const COVERAGE_CONFIG: Record<Coverage, { label: string; color: string; bg: string; icon: any }> = {
  live:       { label: 'Live',      color: '#111',    bg: '#c4ff4d', icon: CheckCircle2 },
  partial:    { label: 'Partial',   color: '#fff',    bg: '#f59e0b', icon: AlertCircle },
  scaffolded: { label: 'Scaffolded',color: '#fff',    bg: '#6366f1', icon: Circle },
  none:       { label: 'Not impl.', color: '#fff',    bg: '#6b7280', icon: Circle },
}

const VERB_CONFIG: Record<Verb, { color: string; bg: string }> = {
  'SHALL':     { color: '#991b1b', bg: '#fee2e2' },
  'SHOULD':    { color: '#78350f', bg: '#fef3c7' },
  'MAY':       { color: '#14532d', bg: '#dcfce7' },
  'SHALL-NOT': { color: '#581c87', bg: '#ede9fe' },
}

function CoverageBadge({ c }: { c: Coverage }) {
  const cfg = COVERAGE_CONFIG[c]
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function ReqRow({ req }: { req: Req }) {
  const vc = VERB_CONFIG[req.verb]
  const metIcon = req.met === true ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#16a34a' }} />
    : req.met === 'partial' ? <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#d97706' }} />
    : <Circle className="w-4 h-4 shrink-0" style={{ color: '#9ca3af' }} />
  return (
    <div className="flex gap-3 py-2.5 border-b border-black/5 last:border-0">
      {metIcon}
      <div className="flex-1 min-w-0">
        <span className="inline-block mr-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: vc.bg, color: vc.color }}>{req.verb}</span>
        <span className="text-[13px] text-[#111]/80">{req.text}</span>
        {req.careosNote && (
          <div className="mt-1 flex items-start gap-1.5 text-[11px] text-[#111]/50">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="font-mono">{req.careosNote}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function EndpointPill({ ep }: { ep: string }) {
  const [method, ...rest] = ep.split(' ')
  const path = rest.join(' ')
  const methodColors: Record<string, string> = { GET: '#4d80ff', POST: '#16a34a', PUT: '#d97706', DELETE: '#dc2626' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111] text-[11px] font-mono mr-1.5 mb-1.5">
      <span className="font-bold" style={{ color: methodColors[method] || '#9ca3af' }}>{method}</span>
      <span className="text-white/70">{path}</span>
    </span>
  )
}

function NodeCard({ node, depth = 0 }: { node: StandardNode; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const [reqOpen, setReqOpen] = useState(false)
  const Icon = node.icon
  const hasChildren = node.children && node.children.length > 0
  const hasReqs = node.reqs && node.reqs.length > 0
  const metCount = node.reqs?.filter(r => r.met === true).length ?? 0
  const partialCount = node.reqs?.filter(r => r.met === 'partial').length ?? 0
  const totalCount = node.reqs?.length ?? 0

  return (
    <div className={`rounded-2xl border border-black/8 overflow-hidden mb-3 ${depth === 0 ? 'shadow-sm' : ''}`} style={{ background: depth === 0 ? '#fff' : '#f7f3eb' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] transition-colors"
      >
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-[#111] flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-[#c4ff4d]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-[#111]">{node.label}</span>
            <CoverageBadge c={node.coverage} />
            {totalCount > 0 && (
              <span className="text-[11px] text-[#111]/40 font-medium">
                {metCount}/{totalCount} requirements met{partialCount > 0 ? ` (${partialCount} partial)` : ''}
              </span>
            )}
          </div>
          <div className="text-[12px] text-[#111]/50 mt-0.5">{node.subtitle}</div>
        </div>
        <div className="shrink-0 mt-1 text-[#111]/30">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-[13px] text-[#111]/65 mb-3 leading-relaxed">{node.summary}</p>

          {/* Endpoints */}
          {node.endpoints && node.endpoints.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#111]/40 mb-1.5">Endpoints</div>
              <div>{node.endpoints.map(ep => <EndpointPill key={ep} ep={ep} />)}</div>
            </div>
          )}

          {/* Source link */}
          {node.source && (
            <a href={node.source} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#4d80ff] hover:underline mb-3"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              HL7 specification source
            </a>
          )}

          {/* Requirements toggle */}
          {hasReqs && (
            <div>
              <button
                onClick={() => setReqOpen(o => !o)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111]/60 hover:text-[#111] mb-2 transition-colors"
              >
                {reqOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Conformance Requirements ({totalCount})
              </button>
              {reqOpen && (
                <div className="rounded-xl border border-black/6 px-3 py-1 bg-[#f7f3eb]/50">
                  {node.reqs!.map((r, i) => <ReqRow key={i} req={r} />)}
                </div>
              )}
            </div>
          )}

          {/* Children */}
          {hasChildren && (
            <div className="mt-3 space-y-2">
              {node.children!.map(child => (
                <NodeCard key={child.id} node={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Summary stats ────────────────────────────────────────────────────────────

function countAll(nodes: StandardNode[]): { live: number; partial: number; total: number; reqs: number; metReqs: number } {
  let live = 0, partial = 0, total = 0, reqs = 0, metReqs = 0
  function walk(n: StandardNode) {
    total++
    if (n.coverage === 'live') live++
    else if (n.coverage === 'partial') partial++
    if (n.reqs) {
      reqs += n.reqs.length
      metReqs += n.reqs.filter(r => r.met === true).length
    }
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return { live, partial, total, reqs, metReqs }
}

// ── Search filter ────────────────────────────────────────────────────────────

function filterNodes(nodes: StandardNode[], q: string): StandardNode[] {
  if (!q) return nodes
  const lower = q.toLowerCase()
  function matchNode(n: StandardNode): StandardNode | null {
    const selfMatch = (
      n.label.toLowerCase().includes(lower) ||
      n.subtitle.toLowerCase().includes(lower) ||
      n.summary.toLowerCase().includes(lower) ||
      (n.endpoints || []).some(e => e.toLowerCase().includes(lower)) ||
      (n.reqs || []).some(r => r.text.toLowerCase().includes(lower) || (r.careosNote || '').toLowerCase().includes(lower))
    )
    const filteredChildren = (n.children || []).map(matchNode).filter(Boolean) as StandardNode[]
    if (selfMatch || filteredChildren.length > 0) {
      return { ...n, children: filteredChildren }
    }
    return null
  }
  return nodes.map(matchNode).filter(Boolean) as StandardNode[]
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FhirStandardsExplorer() {
  const [query, setQuery] = useState('')
  const [filterCoverage, setFilterCoverage] = useState<Coverage | 'all'>('all')
  const [inquireOpen, setInquireOpen] = useState(false)
  const stats = countAll(STANDARDS)
  const filtered = filterNodes(STANDARDS, query).filter(n =>
    filterCoverage === 'all' || n.coverage === filterCoverage
  )

  return (
    <div className="antialiased text-[#111] bg-[#f7f3eb] min-h-screen selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif; }
      `}</style>

      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <Network className="w-4 h-4 text-[#111]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold">by LaunchFlow</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
            <Link to="/" className="hover:text-white transition">How it works</Link>
            <Link to="/fhir-standards" className="text-[#c4ff4d] font-semibold">FHIR</Link>
            <Link to="/research" className="hover:text-white transition">Research</Link>
            <Link to="/live" className="hover:text-white transition flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse"/>Live
            </Link>
          </nav>
          <button onClick={() => setInquireOpen(true)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#111] bg-[#c4ff4d] hover:bg-[#d4ff6d] transition">
            Inquire now <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#111] text-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-[#c4ff4d] text-[11px] uppercase tracking-[0.16em] font-bold mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse" />
            HL7 FHIR R4 · US Core STU 9 · SMART on FHIR
          </div>
          <h1 className="text-[42px] sm:text-[64px] leading-[0.93] tracking-[-0.03em] max-w-4xl mb-6">
            FHIR Standards<br />
            <span className="text-[#c4ff4d]">Conformance Explorer</span>
          </h1>
          <p className="text-[17px] text-white/60 max-w-2xl leading-relaxed mb-10">
            Interactive map of every HL7 FHIR R4, US Core STU 9, SMART on FHIR, CDS Hooks, and USCDI v3
            requirement — and exactly how CareOS implements each one.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Standards nodes', value: stats.total },
              { label: 'Fully implemented', value: stats.live, accent: '#c4ff4d' },
              { label: 'Conformance reqs', value: stats.reqs },
              { label: 'Requirements met', value: `${stats.metReqs}/${stats.reqs}`, accent: '#c4ff4d' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10">
                <div className="text-[28px] font-bold tracking-tight" style={{ color: s.accent || '#fff' }}>{s.value}</div>
                <div className="text-[12px] text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legend */}
      <section className="border-b border-black/8 bg-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[#111]/40">Coverage Legend</span>
          {(Object.entries(COVERAGE_CONFIG) as [Coverage, typeof COVERAGE_CONFIG[Coverage]][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <span key={key} className="flex items-center gap-1.5 text-[12px] font-medium text-[#111]/60">
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.bg === '#c4ff4d' ? '#16a34a' : cfg.bg }} />
                {cfg.label}
              </span>
            )
          })}
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#111]/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Req met
          </span>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#111]/60">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Partial
          </span>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#111]/60">
            <Circle className="w-3.5 h-3.5 text-gray-400" /> Not met
          </span>
        </div>
      </section>

      {/* Search + filter */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111]/30" />
            <input
              type="text"
              placeholder="Search standards, requirements, endpoints, notes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/10 bg-white text-[14px] text-[#111] placeholder:text-[#111]/30 focus:outline-none focus:ring-2 focus:ring-[#c4ff4d] focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'live', 'partial'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterCoverage(f)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all"
                style={{
                  background: filterCoverage === f ? '#111' : '#fff',
                  color: filterCoverage === f ? '#c4ff4d' : '#111',
                  borderColor: filterCoverage === f ? '#111' : '#e5e7eb',
                }}
              >
                {f === 'all' ? 'All' : COVERAGE_CONFIG[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* Node tree */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-[#111]/40">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-[15px]">No matching standards found for "{query}"</p>
          </div>
        ) : (
          <div>
            {filtered.map(node => <NodeCard key={node.id} node={node} depth={0} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#111] text-white mt-12">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="text-[15px] font-bold mb-1">CareOS · by LaunchFlow</div>
            <div className="text-[12px] text-white/40">Business Intuitive Inc. · Seattle, WA · launchflow.tech</div>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'HL7 FHIR R4', url: 'https://hl7.org/fhir/R4/' },
              { label: 'US Core STU 9', url: 'https://hl7.org/fhir/us/core/' },
              { label: 'SMART App Launch', url: 'https://hl7.org/fhir/smart-app-launch/' },
              { label: 'CDS Hooks', url: 'https://cds-hooks.org/' },
              { label: 'USCDI v3', url: 'https://www.healthit.gov/isa/united-states-core-data-interoperability-uscdi' },
            ].map(l => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/20 transition"
              >
                {l.label} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
