# Functional Requirements Specification (FRS)
## Patient-Controlled Health Data Agent

**Version:** 2.0  
**Date:** March 2026  
**Status:** Prototype / Academic Demo

---

## 1. Overview

A patient-facing data agent that stores and manages access to health records using **SMART on FHIR** standards. Healthcare organizations (EHR systems) request access through the agent, which handles AI-assisted consent workflows, OAuth token issuance, payment processing, and FHIR-based data retrieval.

### 1.1 Core Principles

- **Patient control** — patient approves, denies, or approves-with-limits every access request
- **Informed consent** — primary vs secondary use clearly distinguished with transparency language
- **Standards-based** — SMART on FHIR OAuth 2.0 and FHIR R4 resources
- **AI-assisted** — GPT explains consent requests, translates clinical notes, and verifies accuracy
- **Auditable** — data access log showing organization, use type, scopes, status, and issued tokens
- **Open Notes** — patients review clinical notes with AI plain-language translation
- **Compensated** — access fee model where patients are paid for their data

---

## 2. Architecture

### 2.1 Five Docker Services

| # | Service | Technology | Port | Responsibility |
|---|---------|-----------|------|----------------|
| 1 | **Database** | PostgreSQL 16 | 5432 | Persistent data storage |
| 2 | **Data Model** | Python + SQLAlchemy | — | Schema migrations, demo seed data (run-once) |
| 3 | **Backend** | Python / FastAPI | 8000 | REST API, SMART on FHIR auth server, FHIR resource server, WebSocket |
| 4 | **AI Layer** | Python / FastAPI + OpenAI | 8100 | GPT Actions backend, consent explanation, NFC session initiation |
| 5 | **Frontend** | React + TypeScript + Tailwind | 80 | Patient Agent UI, simulated EHR UI |

### 2.2 Data Flow

```
Hospital EHR                    Patient Agent
     │                               │
     │  1. NFC tap / QR scan         │
     │──────────────────────────────►│
     │                               │ 2. AI explains request
     │                               │ 3. Patient approves/denies
     │  4. SMART authorize (code)    │
     │◄──────────────────────────────│
     │  5. Token exchange            │
     │──────────────────────────────►│
     │  6. Bearer token returned     │
     │◄──────────────────────────────│
     │  7. FHIR resource requests    │
     │──────────────────────────────►│
     │  8. FHIR Bundle response      │
     │◄──────────────────────────────│
```

---

## 3. Functional Requirements

### 3.1 Patient Agent (Frontend)

| ID | Requirement | Priority |
|----|-------------|----------|
| PA-01 | Patient dashboard showing notifications, pending requests, quick links | High |
| PA-02 | View health records (diagnoses, medications, allergies, labs, encounters) | High |
| PA-03 | Review and approve/flag clinical notes with Open Notes workflow | High |
| PA-04 | Approve, deny, or approve-with-limits access requests from organizations | High |
| PA-05 | View audit trail of all data access events | High |
| PA-06 | Real-time push notifications via WebSocket | High |
| PA-07 | AI-generated explanation of consent requests (primary/secondary aware) | High |
| PA-08 | AI-generated summary of data to be shared | Medium |
| PA-09 | WebSocket connection status indicator | Low |
| PA-10 | Data Access Log page with filtering by use_type, organization, date range | High |
| PA-11 | AI plain-language translation of clinical notes | High |
| PA-12 | AI verification checklist for clinical note accuracy | High |
| PA-13 | Approve-with-limits UI: time window, access duration, data categories | High |
| PA-14 | Secondary use notice banner for research/QI/public health requests | High |
| PA-15 | Fulfillment Preferences page: choose preferred lab, pharmacy, specialist, payer | High |
| PA-16 | Visit Fulfillment page: task checklist with status tracking per task | High |
| PA-17 | Send Now button to dispatch queued fulfillment tasks via connectors | High |
| PA-18 | AI Fulfillment Summary: checklist, what to expect, patient actions | Medium |
| PA-19 | Resolve Missing Info action for tasks needing patient input | Medium |

### 3.2 EHR System (Frontend — Simulated)

| ID | Requirement | Priority |
|----|-------------|----------|
| EHR-01 | Send access requests to patients (with use_type and secondary_purpose) | High |
| EHR-02 | View status of access requests | High |
| EHR-03 | Pay access fee to retrieve records | High |
| EHR-04 | View retrieved FHIR records with tabbed interface | High |
| EHR-05 | Raw FHIR JSON view | Medium |
| EHR-06 | Clinician View: real-time monitoring of patient consent decisions | High |
| EHR-07 | Clinician View: Fetch FHIR Records button for approved requests | High |
| EHR-08 | Clinician View: Fulfillment status panel (Labs/Rx/Referral/Prior Auth status) | High |

### 3.3 SMART on FHIR Authorization Server

| ID | Requirement | Priority |
|----|-------------|----------|
| SF-01 | Discovery endpoint (`/.well-known/smart-configuration`) | High |
| SF-02 | FHIR CapabilityStatement with SMART security extensions | High |
| SF-03 | Authorization endpoint (`/auth/authorize`) with code grant | High |
| SF-04 | Token exchange endpoint (`/auth/token`) returning JWT Bearer tokens | High |
| SF-05 | Token introspection endpoint (`/auth/introspect`) | High |
| SF-06 | Scope-based access control (e.g., `patient/Condition.read`) | Medium |
| SF-07 | Token expiry and revocation | Medium |

### 3.4 FHIR Resource Server

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Patient resource endpoint | High |
| FR-02 | Condition (diagnoses) search endpoint | High |
| FR-03 | MedicationRequest search endpoint | High |
| FR-04 | AllergyIntolerance search endpoint | High |
| FR-05 | Observation (lab results) search endpoint | High |
| FR-06 | Encounter search endpoint | High |
| FR-07 | Dual auth: Bearer token (SMART) or legacy org_id query param | High |

### 3.5 AI Layer (GPT Actions)

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-01 | Explain consent request in patient-friendly language (primary/secondary aware) | High |
| AI-02 | Summarize what data would be shared (with record counts) | High |
| AI-03 | Help patient approve/deny/approve-with-limits with informed decision | High |
| AI-04 | Trigger backend to create/confirm consent and issue tokens | High |
| AI-05 | OpenAPI schema compatible with GPT Builder Actions import | High |
| AI-06 | NFC/QR session initiation (one-time session token) | Medium |
| AI-07 | Session status checking | Medium |
| AI-08 | AI interaction audit logging | Medium |
| AI-09 | Mock LLM fallback when no OpenAI API key is configured | Medium |
| AI-10 | Translate clinical notes to plain language (`/notes/translate`) | High |
| AI-11 | Generate verification checklist for clinical notes (`/notes/verify`) | High |
| AI-12 | Include transparency language for secondary use in consent explanations | High |
| AI-13 | Suggest "Approve with limits" options (time window, categories, duration) | High |
| AI-14 | Summarize fulfillment packet for patient (`/fulfillment/summarize`) | Medium |

### 3.6 Real-Time Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| RT-01 | WebSocket endpoint per patient (`/ws/patient/{id}`) | High |
| RT-02 | Push notification when new access request arrives (includes use_type/secondary_purpose) | High |
| RT-03 | Internal HTTP endpoint for services to trigger push | High |
| RT-04 | Auto-reconnect on connection loss | Medium |
| RT-05 | Connection status monitoring endpoint | Low |
| RT-06 | Push `fulfillment_packet_created` event when packet is generated | Medium |
| RT-07 | Push `fulfillment_task_updated` event when tasks are sent/completed | Medium |

### 3.7 NFC / QR Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| NFC-01 | NFC tap creates a one-time consent session token | Medium |
| NFC-02 | Session token encodes org ID, patient ID, scopes, expiry | Medium |
| NFC-03 | QR code payload with deep link URL | Medium |
| NFC-04 | Session expires after 15 minutes | Medium |
| NFC-05 | NFC starts consent; HTTPS/FHIR moves the data | Medium |

### 3.8 Access Control & Payment

| ID | Requirement | Priority |
|----|-------------|----------|
| AC-01 | Organization must have approved access request | High |
| AC-02 | Access fee ($25 default) must be paid before data retrieval | High |
| AC-03 | Payment status tracking (pending, completed, failed) | High |
| AC-04 | Access log entry created for every significant action | High |

### 3.9 Data Model

| ID | Requirement | Priority |
|----|-------------|----------|
| DM-01 | Standalone migrations container (runs on startup, exits) | High |
| DM-02 | Demo seed data with realistic patient records | High |
| DM-03 | Organizations with SMART client credentials | High |
| DM-04 | ConsentSession model for NFC/QR launch contexts | Medium |
| DM-05 | AccessToken model for JWT token storage | High |
| DM-06 | AIInteraction model for audit of GPT calls | Medium |
| DM-07 | AccessRequest: use_type (primary_care/secondary_use) and secondary_purpose fields | High |
| DM-08 | AccessRequest: approved_time_window, approved_duration, approved_categories fields | High |
| DM-09 | NoteReview model for Open Notes patient review (status, comment) | High |
| DM-10 | Demo seed: primary care + secondary use (research) access requests | High |
| DM-11 | Destination table (unified: lab, pharmacy, provider, payer) with contact info | High |
| DM-12 | FulfillmentPacket model (patient_id, encounter_id, source_note_id, items_json, status) | High |
| DM-13 | FulfillmentTask model (type, destination_type, destination_id, payload_json, status) | High |
| DM-14 | FulfillmentPreferences model (preferred lab/pharmacy/payer/specialist ids) | High |
| DM-15 | Seed: 2 labs, 2 pharmacies, 2 provider offices, 1 payer, 1 patient preferences, 1 demo packet with 4 tasks | High |

### 3.10 Fulfillment Routing + Connectors

| ID | Requirement | Priority |
|----|-------------|----------|
| FL-01 | Connector framework with BaseConnector interface and SendResult dataclass | High |
| FL-02 | LabConnectorStub: logs lab order, simulates acknowledgement | High |
| FL-03 | PharmacyConnectorStub: routes Rx request without modifying prescriptions (immutability) | High |
| FL-04 | ProviderOfficeConnectorStub: sends referral packet, simulates scheduling | High |
| FL-05 | InsuranceConnectorStub: generates prior-auth packet, simulates submission | High |
| FL-06 | TaskRouter: selects connector by destination_type and dispatches | High |
| FL-07 | POST `/api/patient/{id}/fulfillment/packets` — create packet from encounter/note | High |
| FL-08 | GET `/api/patient/{id}/fulfillment/packets` — list packets with tasks | High |
| FL-09 | POST `/api/patient/{id}/fulfillment/packets/{id}/send` — dispatch queued tasks | High |
| FL-10 | GET `/api/destinations?kind=` — destination directory | High |
| FL-11 | POST `/api/patient/{id}/preferences` — update preferred routing destinations | High |
| FL-12 | GET `/api/clinician/patient/{id}/fulfillment/packets` — clinician visibility | High |
| FL-13 | Connectors are stubs for demo; structured for real adapter replacement | High |
| FL-14 | Tasks are immutable: routing only, no modification of prescriptions/orders | High |

### 3.11 EHR Vendor Adapters

| ID | Requirement | Priority |
|----|-------------|----------|
| VA-01 | BaseEhrAdapter interface: SMART discovery, OAuth authorize/token/refresh, FHIR fetch, introspect | High |
| VA-02 | EpicAdapter: FHIR R4, .well-known/smart-configuration, USCDI resource scopes (no wildcards), Bulk Data stub | High |
| VA-03 | CernerAdapter: FHIR R4, explicit patient/ scopes, EHR launch + standalone launch (launch/patient), MPages note | High |
| VA-04 | MeditechAdapter: dual profile (Argonaut DSTU2 + US Core STU7 R4), OpenID Connect, manual patient linking | High |
| VA-05 | EHR adapter router: selects adapter class by Organization.ehr_vendor field | High |
| VA-06 | Organization model: ehr_vendor (epic/cerner/meditech/other), smart_discovery_mode, fhir_profile fields | High |
| VA-07 | GET `/api/ehr-adapters/org/{id}/info` — adapter info with SMART config, scopes, resources | High |
| VA-08 | GET `/api/ehr-adapters/org/{id}/smart-config` — discovered SMART endpoints | High |
| VA-09 | GET `/api/ehr-adapters/org/{id}/resources` — vendor-supported FHIR resources | High |
| VA-10 | POST `/api/ehr-adapters/org/{id}/fetch/{ResourceType}` — simulated vendor FHIR fetch | High |
| VA-11 | All adapters are structured stubs; no real vendor API calls in demo | High |
| VA-12 | Seed data: Metro General=Epic, Riverside=Cerner, Pacific=MEDITECH | High |
| VA-13 | Clinician View displays vendor badge (Epic/Cerner/MEDITECH) per organization | Medium |
| VA-14 | Reference doc: `docs/ehr-api-links.md` with canonical API links for all three vendors | Medium |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF-01 | All services containerized as separate Docker images |
| NF-02 | Single `docker compose up` to start entire system |
| NF-03 | Data-model service runs before backend starts |
| NF-04 | Frontend served via nginx with reverse proxy to backend, AI layer, and WebSocket |
| NF-05 | CORS configured for local dev and production |
| NF-06 | PostgreSQL data persisted via Docker volume |
| NF-07 | AI Layer works with or without OpenAI API key (mock fallback) |

---

## 5. Custom GPT Integration

The AI Layer exposes an OpenAPI schema at `/openapi-actions.json` that can be imported directly into the GPT Builder. The GPT can:

1. **Explain consent requests** — call `/consent/explain` with org name, purpose, scopes, use_type, secondary_purpose
2. **Summarize data** — call `/consent/summarize-data` with patient ID and scopes
3. **Record decisions** — call `/consent/decide` with session ID and approve/deny/approve-with-limits + limit params
4. **Translate clinical notes** — call `/notes/translate` for plain-language translation
5. **Verify clinical notes** — call `/notes/verify` for accuracy verification checklist
6. **Initiate NFC sessions** — call `/session/initiate-nfc` to create tap-to-consent flows
7. **Check session status** — call `/session/status` with session token

The GPT does NOT talk directly to hospital EHR endpoints. The patient agent backend handles all FHIR communication.

---

## 6. Demo Scenario

### Primary Care Flow
1. Hospital staff sends primary care access request (use_type=primary_care)
2. Patient receives real-time push notification with use type indicator
3. AI assistant explains this is a primary care request for coordinated care
4. Patient clicks "AI Explain" to see detailed breakdown and risk summary
5. Patient approves the request (full access)
6. Clinician View shows approval in real-time, clinician clicks "Fetch FHIR Records"

### Secondary Use Flow
1. Research org sends access request (use_type=secondary_use, secondary_purpose=research)
2. Patient sees purple "Secondary Use" and "Research" badges
3. AI warns this may not directly benefit personal care
4. Patient clicks "Approve with Limits": last 12 months, one-time access, Condition + Observation only
5. Limits are recorded and visible in the Data Access Log

### Open Notes Flow
1. Patient navigates to Clinical Notes page
2. Clicks "Plain Language" to get AI translation of a clinical note
3. Clicks "Verify Accuracy" to get a checklist of items to confirm
4. Reviews checklist, then approves the note or flags an inaccuracy with comments

### Full Audit Trail
- Data Access Log shows every access request with organization, use type, secondary purpose, scopes, status, and issued token ID
- Filterable by use type (primary care vs secondary use)
