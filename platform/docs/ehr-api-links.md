# EHR API Links Reference (Epic, Cerner, MEDITECH) — for Backend Integration + Security Layer

Use this as the "source-of-truth link pack" for vendor connectors and OAuth/SMART security.

---

## Epic

### 1) Epic on FHIR — API specifications + developer docs
- Epic on FHIR (home): https://fhir.epic.com/
- API Specifications landing: https://fhir.epic.com/Specifications
- Example spec page: https://fhir.epic.com/Specifications?api=10506

### 2) Epic Vendor Services — Open Epic APIs catalog
- Open Epic APIs catalog: https://vendorservices.epic.com/OpenEpicApis
- Vendor Services portal: https://vendorservices.epic.com/

### 3) open.epic — program + endpoints directory
- open.epic program home: https://open.epic.com/
- Endpoints directory: https://open.epic.com/MyApps/Endpoints

**Security notes (Epic):**
- SMART on FHIR OAuth 2.0 patterns + scopes (see Epic on FHIR docs hub).
- Treat "endpoint selection" as an org-level configuration step (per health system).

### Key USCDI FHIR APIs (Epic)
- AllergyIntolerance (Read/Search)
- CarePlan (Encounter-Level, Longitudinal)
- CareTeam (Longitudinal)
- Clinical Notes (Binary, DocumentReference)
- Condition (Problems, Encounter Diagnosis, Health Concern)
- Coverage (Read/Search)
- Device (Implants)
- DiagnosticReport (Results)
- Encounter (Patient Chart)
- ExplanationOfBenefit (Claim, Prior Auth)
- Goal (Care Plan, Patient)
- Immunization (Read/Search)
- Location (Read/Search)
- Medication / MedicationRequest / MedicationDispense
- Observation (Labs, Vitals, Social History, Assessments, SDOH)
- Organization (Read/Search)
- Patient (Demographics)
- Practitioner / PractitionerRole
- Procedure (Orders, Surgeries, SDOH Intervention)
- Provenance (Read)
- ServiceRequest (Order Procedure, Community Resource)
- Specimen (Read/Search)
- Bulk Data (Group kick-off, status, file, delete)
- OAuth 2.0 including Introspect

---

## Cerner (Oracle Health) — SMART on FHIR

### 1) SMART on FHIR tutorial + workflow reference
- Cerner SMART on FHIR tutorial: https://engineering.cerner.com/smart-on-fhir-tutorial/
- SMART scheduling tutorial: https://engineering.cerner.com/smart-on-fhir-scheduling-tutorial/

### 2) Cerner SMART documentation
- Cerner SMART doc: https://github.com/cerner/fhir.cerner.com/blob/main/content/smart.md

### 3) SMART Health IT sandbox (cross-vendor testing)
- SMART App Launcher: https://launch.smarthealthit.org

**Security notes (Cerner):**
- SMART launch uses `iss` (FHIR base) + `launch` parameters; authorize → redirect → token exchange.
- No wildcard `patient/*.read`; specify resources explicitly (e.g. `patient/Patient.read patient/Observation.read`).
- Read auth endpoints from FHIR metadata / SMART config.
- Supports EHR launch and standalone launch (`launch/patient` scope for patient context).
- MPages integration requires XFC (Cross-Frame-Container) for embedding.

### Key Cerner FHIR Resources
- Patient, Observation, Condition, MedicationRequest, AllergyIntolerance
- Encounter, Procedure, Immunization, Goal, CarePlan
- DiagnosticReport, DocumentReference
- Supports DSTU2 and R4

---

## MEDITECH — FHIR Patient Access (Argonaut / US Core)

### 1) MEDITECH API Explorer
- US Core STU7 (R4): https://fhir.meditech.com/explorer/api/uscore.STU7/2
- Endpoints page: https://fhir.meditech.com/explorer/endpoints

### 2) Argonaut Data Query IG
- Argonaut R2: https://www.fhir.org/guides/argonaut/r2/

**Security notes (MEDITECH):**
- OAuth 2.0 + OpenID Connect for patient apps.
- External identity providers (tested with Google Identity).
- Patient-to-record linking is manual (model as "linked identities").
- Support both Argonaut/DSTU2 paths and US Core STU7/R4 paths (prefer R4).

### MEDITECH Argonaut R2 APIs
- AllergyIntolerance, CarePlan, Condition, Device
- DiagnosticReport, DocumentReference, Goal
- Immunization, MedicationOrder, MedicationStatement
- Observation, Patient, Practitioner, Procedure

### MEDITECH US Core STU7 (R4) APIs
- AllergyIntolerance, Appointment, Binary, CarePlan, CareTeam
- Communication, Condition, Coverage, Device
- DiagnosticReport, DocumentReference, Encounter
- Goal, Group, Immunization, Location, Media
- Medication, MedicationDispense, MedicationRequest
- Observation, Organization, Patient, Person
- Practitioner, PractitionerRole, Procedure, Provenance
- QuestionnaireResponse, RelatedPerson, ServiceRequest
- Specimen, Task, ValueSet

---

## Cross-vendor security layer

### OAuth / SMART / OIDC capabilities to build
- SMART discovery (prefer `.well-known/smart-configuration`; fall back to FHIR CapabilityStatement).
- Authorization Code flow (PKCE for public clients; client_secret for confidential server-side).
- Token handling: store access_token, refresh_token, expires_at; per-Org issuer validation.
- Token introspection (when supported) + audit logging.
- Scope enforcement: patient context scopes vs user scopes; least-privilege per use-case.

### Testing harness
- Use SMART Health IT Launcher to simulate EHR launch flows: https://launch.smarthealthit.org

---

## Org-level config fields
- `ehr_vendor` (epic | cerner | meditech)
- `fhir_base_url`
- `smart_discovery_mode` (smart_config | capability_statement)
- `fhir_profile` (r4 | dstu2 | us_core_stu7)
- `client_id`, `client_secret`, `redirect_uri`
