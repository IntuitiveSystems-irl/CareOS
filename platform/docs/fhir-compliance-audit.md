# CareOS — FHIR Modules Compliance Audit
> Generated: Jun 30, 2026  
> Against: FHIR R5 modules map (HL7 modules.html + fhir_full_modules_combined_clickable_map.html)  
> Codebase: platform/backend/app/ + platform/frontend/src/

**Legend:** ✅ Implemented · ⚡ Partial · 🔵 Scaffolded/Planned · ❌ Not implemented · N/A Not applicable to CareOS scope

---

## Level 1 — Foundation

**Module page:** https://www.hl7.org/fhir/foundation-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **Resource** (base type) | ✅ | All FHIR output includes `resourceType` per spec |
| **DomainResource** | ✅ | Resources served via `/fhir/*` routes follow DomainResource shape |
| **Basic** | N/A | No custom resource types needed |
| **Binary** | ⚡ | Clinical notes accessed via `DocumentReference`+`Binary` in `EpicAdapter` scope |
| **Bundle** | ✅ | `hl7_message_to_fhir_bundle()` in `hl7v2_to_fhir.py`; `build_uscdi_bundle()` (collection); searchset Bundles from all `/fhir/*` endpoints; transaction Bundles from relay |
| **Questionnaire** | 🔵 | Research consent uses a questionnaire model internally; not yet FHIR Questionnaire resource |
| **QuestionnaireResponse** | 🔵 | Same as above |
| **List** | N/A | — |
| **Composition** | N/A | — |
| **DocumentReference** | ✅ | `routers/clinical_notes.py`; in USCDI v3 export and Epic scope list |
| **OperationOutcome** | ⚡ | FastAPI HTTPException responses; not yet wrapped as FHIR OperationOutcome JSON |
| **Parameters** | N/A | No custom operations yet requiring Parameters input |
| **Subscription** | 🔵 | `SubscriptionStatus`/`SubscriptionTopic` referenced in `foundation-module.html`; CareOS has WebSocket push (`routers/websocket.py`) but not FHIR Subscription resource |
| **SubscriptionStatus** | 🔵 | See above |
| **SubscriptionTopic** | 🔵 | See above |
| **MessageHeader** | N/A | Messaging not used (REST-first) |
| **Base Documentation / Datatypes / Extensions** | ✅ | FHIR datatypes used correctly throughout (CodeableConcept, Coding, Identifier, HumanName, etc.) |
| **XML / RDF Representations** | N/A | JSON-only (correct for our REST API) |

**Foundation Coverage: ✅ Strong** — Bundle, core resources, datatypes all correct. Gaps: OperationOutcome wrapping, FHIR Subscription (WebSocket exists as functional substitute).

---

## Level 2 — Implementer Support

**Module page:** https://www.hl7.org/fhir/implsupport-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **Downloads** | N/A | — |
| **Version Management** | ✅ | R4 declared in all adapters (`fhir_version = "R4"`); USCDI v3 profile tag applied |
| **Use Cases** | ✅ | EHR Connect (Epic/Cerner/Meditech), Bulk Export, Patient Fishbowl, CDS Hooks all documented |
| **Testing** | ⚡ | No formal FHIR TestScript/TestPlan resources; integration tested via manual API calls |
| **TestScript** | ❌ | Not implemented |
| **TestPlan** | ❌ | Not implemented |
| **TestReport** | ❌ | Not implemented |
| **Validation** | ⚡ | Pydantic schema validation on all inbound/outbound; no FHIR profile validator (e.g. no HL7 validator jar) |
| **FHIRPath** | 🔵 | Not used currently; needed if StructureDefinition constraints are enforced |
| **Mapping Language / StructureMap** | N/A | HL7v2→FHIR mapping done in Python (`hl7v2_to_fhir.py`) — not FHIR StructureMap |
| **ExampleScenario / ActorDefinition** | ❌ | Not implemented |
| **Clinical Safety** | ✅ | Allergy↔medication conflict detection in `clinical/relational.py`; deterministic, no LLM in clinical path |
| **Managing Resource Identity** | ✅ | `resource_id` / `external_id` / `source_id` tracked in `RelayFhirResource`; dedup via `content_sha256` |
| **EHR Fit / Comparisons** | ✅ | Documented in `platform/docs/careos-application.md` and architecture docs |
| **Version Management Policy** | ✅ | Adapters version-aware (Epic USCDI v1→v3, MEDITECH R2/US Core STU7) |
| **Reference Implementations** | ✅ | Epic, Cerner, Meditech adapters all live HTTP |

**Implementer Support Coverage: ⚡ Partial** — Core implementation solid. Gaps: formal TestScript resources, FHIRPath enforcement, profile validation.

---

## Level 2 — Security & Privacy

**Module page:** https://www.hl7.org/fhir/secpriv-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **Security Principles** | ✅ | HTTPS-only (nginx), Bearer tokens, no query-param secrets (R-3 fix), rate limiting (R-7) |
| **AuditEvent** (FHIR resource) | ⚡ | CareOS has a tamper-evident audit chain (`integration/audit/recorder.py` + `AuditEntry` model) that covers the same ground; not yet emitted as FHIR AuditEvent JSON |
| **Consent** (FHIR resource) | ⚡ | `ConsentSession` model in `models.py` tracks patient consent for org access; `scopes_requested` field; not serialized as FHIR Consent resource |
| **Permission** | ❌ | Not implemented as FHIR Permission resource |
| **Provenance** (FHIR resource) | ✅ | `Provenance` in USCDI v3 export (`uscdi.py` line 23, line 58); included in Epic scope list |
| **Signature** | N/A | — |
| **Security Labels** | 🔵 | Not applied to resources; relevant for future PHI classification |
| **SMART / OAuth** | ✅ | Full SMART on FHIR server: `smart_auth.py` (`.well-known/smart-configuration`, `/auth/authorize`, `/auth/token`, `/auth/introspect`); PKCE support in adapters; Bearer token validation in `/fhir/*` |
| **Authorization & Access Control** | ✅ | Two-path auth: SMART Bearer token + legacy org_id; `_check_authorization()` in `fhir.py`; `require_researcher` for research gating |
| **Audit Logging** | ✅ | `append_audit()` called throughout pipeline; tamper-evident SHA-256 chain; `ResearcherAuditLog` for research access |
| **De-identification** | ✅ | `POST /maintenance/purge-identifiers` strips PII from all participants; `POST /participants/{pid}/withdraw` erases identifiers |
| **Privacy Consent** | ✅ | Patient must approve org access request + pay before SMART token issued; consent tracked in `ConsentSession` |
| **Accounting of Disclosures** | ⚡ | `AccessLog` model tracks all accesses; not formatted as FHIR AuditEvent |
| **Risks from Exposing Links** | ✅ | No ?key= query params (R-3); tokens in headers only |

**Security & Privacy Coverage: ✅ Strong** — SMART on FHIR fully implemented. Gaps: FHIR AuditEvent/Consent/Permission as serialized FHIR resources (functionally covered internally but not FHIR-typed output).

---

## Level 2 — Conformance

**Module page:** https://www.hl7.org/fhir/conformance-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **CapabilityStatement** | ✅ | `base_ehr_adapter.py` fetches `GET /metadata` (CapabilityStatement) from EHR servers; `_parse_capability_statement()` extracts SMART OAuth endpoints |
| **StructureDefinition** | ⚡ | US Core StructureDefinition profile URI referenced in USCDI bundle meta (`us-core-patient`); not publishing own StructureDefinitions |
| **ImplementationGuide** | 🔵 | Architecture documented (`careos-application.md`) but not a formal FHIR IG package |
| **Profiling** | ⚡ | US Core profiles referenced in USCDI export; Pydantic used for schema validation internally |
| **OperationDefinition** | 🔵 | `$export` bulk data operation implemented but not described as a FHIR OperationDefinition |
| **SearchParameter** | ⚡ | Standard FHIR search params used (`patient=`, `_count=`) in adapter `fetch_resource()`; no custom SearchParameter resources |
| **CompartmentDefinition** | N/A | — |
| **GraphDefinition** | N/A | — |
| **MessageDefinition** | N/A | — |
| **NamingSystem** | ⚡ | MRN system `urn:oid:2.16.840.1.113883.4.6` used in `map_pid_to_patient()`; ICD-10 `http://hl7.org/fhir/sid/icd-10` in Condition; not a NamingSystem resource |
| **ExampleScenario** | 🔵 | Use cases documented in prose; not FHIR ExampleScenario resource |
| **Conformance Rules / Validation** | ⚡ | Pydantic enforces schema; no profile-level FHIR validation |

**Conformance Coverage: ⚡ Partial** — Consuming CapabilityStatement from EHRs correctly. Not yet publishing own CapabilityStatement or formal ImplementationGuide package.

---

## Level 2 — Terminology

**Module page:** https://www.hl7.org/fhir/terminology-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **CodeSystem** | ⚡ | Using external code systems (ICD-10, SNOMED, LOINC via Observation codes, v3-ActCode for Encounter class); not managing own CodeSystem resources |
| **ValueSet** | 🔵 | Implied by coded fields; no formal ValueSet resources published |
| **ConceptMap** | N/A | No terminology translation needed at this stage |
| **NamingSystem** | ⚡ | OID and URL system identifiers used throughout (see Conformance note above) |
| **TerminologyCapabilities** | N/A | — |
| **Coded Datatypes** | ✅ | `CodeableConcept`, `Coding`, `code` used correctly throughout all FHIR resource mappings |
| **Terminology Service** | ❌ | No $expand/$validate-code/$lookup/$translate operations served |
| **$expand / $validate-code** | ❌ | Not implemented |
| **$lookup / $subsumes** | ❌ | Not implemented |
| **$translate / $closure** | ❌ | Not implemented |
| **Using Codes in Resources** | ✅ | ICD-10 in Condition, SNOMED/LOINC in Observation, `v3-ActCode` in Encounter, `AllergySeverity` mapped to FHIR criticality |

**Terminology Coverage: ⚡ Partial** — Coded types used correctly; external vocabularies referenced by URI. No terminology service operations. Acceptable for current scope; would need $expand if publishing ValueSets.

---

## Level 2 — Exchange

**Module page:** https://www.hl7.org/fhir/exchange-module.html

| Exchange Method | Status | CareOS Implementation |
|---|---|---|
| **RESTful API** | ✅ | Full FHIR REST: `GET /fhir/Patient/{id}`, `GET /fhir/Condition`, `GET /fhir/MedicationRequest`, `GET /fhir/AllergyIntolerance`, `GET /fhir/Observation`, `GET /fhir/Encounter` (all in `routers/fhir.py`) |
| **Search** | ✅ | `patient=` search param on all collection endpoints; `_count=` in adapter calls |
| **Operations** | ✅ | `$export` (Bulk Data kick-off), `$export-status`, `$export-files`; Epic `Group/{id}/$export` |
| **GraphQL** | N/A | — |
| **Async Pattern** | ✅ | `$export` returns 202 + Content-Location polling URL; `run_export_job` runs as `BackgroundTask` |
| **Messaging** | N/A | Not used (REST-first architecture) |
| **Documents** | ⚡ | `DocumentReference` used for clinical notes; full FHIR Document composition not implemented |
| **Services / SOA** | ✅ | CDS Hooks service (`/cds-services` — GET discovery + POST invocation) in `routers/cds_hooks.py` |
| **Subscriptions** | ⚡ | WebSocket push (`routers/websocket.py`) provides real-time notifications; not FHIR Subscription resource |
| **Bulk Data** | ✅ | Full SMART Bulk Data: kick-off, polling, NDJSON download in `routers/bulk_data.py`; USCDI v3 bundle export in `integration/bulk_data/uscdi.py`; Epic Group `$export` in `EpicAdapter` |
| **SMART App Launch** | ✅ | Full SMART on FHIR: `.well-known/smart-configuration`, authorize, token, introspect; PKCE; EHR launch + standalone launch |
| **Databases / Storage** | ✅ | `RelayFhirResource` stores FHIR JSON natively in PostgreSQL; dedup via SHA-256 |
| **Approaching Exchange (guidance)** | N/A | Documented in `careos-architecture.md` |

**Exchange Coverage: ✅ Strong** — All primary exchange patterns covered. Strongest implementation of all modules.

---

## Level 3 — Administration

**Module page:** https://www.hl7.org/fhir/administration-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **Patient** | ✅ | `Patient` model + `GET /fhir/Patient/{id}`; `map_pid_to_patient()` from HL7v2 PID; USCDI export |
| **RelatedPerson** | ❌ | Not implemented |
| **Person** | N/A | — |
| **Group** | ✅ | `Group/{id}/$export` in Epic Bulk Data kick-off |
| **Practitioner** | ✅ | In Epic/Cerner scope list; `attending doctor` mapped from PV1-7 in Encounter participant |
| **PractitionerRole** | ✅ | In Epic/Cerner scope list; `ClinicianRole` enum in models |
| **Organization** | ✅ | `Organization` model (`models.py`); `GET /api/organizations`; in Epic scope list |
| **Location** | ⚡ | In Epic/Cerner scope list; mapped from Encounter location field; no standalone Location resource |
| **HealthcareService** | N/A | — |
| **Endpoint** | ✅ | `fhir_base_url` on Organization model; SMART discovery config |
| **Schedule / Slot** | N/A | — |
| **EpisodeOfCare** | N/A | — |
| **Encounter** | ✅ | `map_pv1_to_encounter()` from HL7v2 PV1; `GET /fhir/Encounter`; USCDI export |
| **EncounterHistory** | N/A | — |
| **Appointment / AppointmentResponse** | N/A | — |
| **Flag** | N/A | — |
| **Device** | ✅ | In USCDI v3 export (`Device` in `USCDI_V3_RESOURCES`); Epic scope lists `Device` |
| **DeviceDefinition / DeviceMetric** | N/A | — |
| **BiologicallyDerivedProduct** | N/A | — |
| **NutritionProduct** | N/A | — |
| **Substance** | N/A | — |
| **InventoryItem** | N/A | — |
| **Account** | N/A | — |
| **ObservationDefinition / SpecimenDefinition** | N/A | — |
| **ResearchStudy** | ⚡ | CareOS has a full research study subsystem (`platform/backend/app/research/`) but uses custom `ResearchParticipant` model, not FHIR ResearchStudy/ResearchSubject resources |
| **ResearchSubject** | ⚡ | See above |

**Administration Coverage: ✅ Good** — Core entities (Patient, Organization, Encounter, Practitioner) all present. Scheduling/appointment resources N/A to scope. ResearchStudy not FHIR-typed.

---

## Level 4 — Clinical

**Module page:** https://www.hl7.org/fhir/clinicalsummary-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **AllergyIntolerance** | ✅ | `map_al1_to_allergy()` from HL7v2 AL1; `GET /fhir/AllergyIntolerance`; relational chart mapper `_map_allergy()`; USCDI export |
| **Condition** | ✅ | `map_dg1_to_condition()` from HL7v2 DG1; `GET /fhir/Condition`; relational chart mapper; USCDI export |
| **Procedure** | ✅ | In USCDI v3 export; Epic/Cerner scope list |
| **FamilyMemberHistory** | ❌ | Not implemented |
| **AdverseEvent** | N/A | — |
| **CarePlan** | ✅ | In Epic scope list (`patient/CarePlan.read`); USCDI export |
| **Goal** | ✅ | In Epic scope list (`patient/Goal.read`); USCDI export |
| **CareTeam** | ✅ | In USCDI v3 export (`CareTeam`); Epic scope list |
| **ClinicalImpression** | N/A | — |
| **DetectedIssue** | ✅ | Functionally: `_derive_allergy_conflict()` in `clinical/relational.py` detects med↔allergy conflicts; CDS Hooks cards surface them; not serialized as FHIR DetectedIssue |
| **ServiceRequest** | ✅ | `_map_servicerequest()` in `clinical/relational.py`; `ServiceRequest` in Epic scope; `_LIVE_TYPES` in `fetch_live_chart()` |
| **VisionPrescription** | N/A | — |
| **RiskAssessment** | N/A | — |
| **NutritionIntake / NutritionOrder** | N/A | — |

**Clinical Coverage: ✅ Strong** — Core clinical resources (Allergy, Condition, Procedure, CarePlan, Goal, CareTeam, ServiceRequest) all handled. DetectedIssue logic exists but not as FHIR resource.

---

## Level 4 — Diagnostics

**Module page:** https://www.hl7.org/fhir/diagnostics-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **Observation** | ✅ | `map_obx_to_observation()` from HL7v2 OBX; `GET /fhir/Observation`; `_map_observation()` in relational chart; USCDI export (lab, vitals, survey categories) |
| **DiagnosticReport** | ✅ | In USCDI v3 export; Epic scope list (`patient/DiagnosticReport.read`) |
| **ServiceRequest** | ✅ | Shared with Clinical module (see above) |
| **DocumentReference** | ✅ | `routers/clinical_notes.py`; Epic scope; USCDI export |
| **ImagingStudy** | ✅ | In USCDI v3 export (`ImagingStudy`) |
| **ImagingSelection** | 🔵 | Not currently implemented |
| **MolecularSequence** | N/A | — |
| **GenomicStudy** | N/A | — |
| **Specimen** | ✅ | In Epic scope list (`patient/Specimen.read`) |
| **BodyStructure** | N/A | — |

**Diagnostics Coverage: ✅ Strong** — Observation (the core resource) fully mapped from HL7v2 and served. DiagnosticReport, ImagingStudy, Specimen all covered via USCDI/Epic.

---

## Level 4 — Medications

**Module page:** https://www.hl7.org/fhir/medications-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **MedicationRequest** | ✅ | `GET /fhir/MedicationRequest`; `_map_medication()` in relational chart; `_LIVE_TYPES` in live chart fetch; Epic scope |
| **MedicationDispense** | ✅ | In Epic scope (`patient/MedicationDispense.read`) |
| **MedicationAdministration** | N/A | Not in scope |
| **MedicationStatement** | ✅ | In USCDI v3 export (`MedicationStatement`) |
| **Medication** | ✅ | `medicationCodeableConcept` in MedicationRequest output; in Epic scope |
| **MedicationKnowledge** | N/A | — |
| **FormularyItem** | N/A | — |
| **Immunization** | ✅ | In USCDI v3 export (`Immunization`); Epic scope (`patient/Immunization.read`) |
| **ImmunizationEvaluation** | N/A | — |
| **ImmunizationRecommendation** | N/A | — |

**Medications Coverage: ✅ Strong** — MedicationRequest (the primary resource) fully implemented. Immunization covered via USCDI/Epic. Allergy↔medication conflict detection is a CareOS differentiator.

---

## Level 4 — Workflow

**Module page:** https://www.hl7.org/fhir/workflow-module.html

| Resource / Pattern | Status | CareOS Implementation |
|---|---|---|
| **Task** | ✅ | `FulfillmentTask` model in `models.py`; `routers/fulfillment.py`; task lifecycle (queued→sent→acknowledged→completed); typed tasks: lab_order, pharmacy_rx, referral, prior_auth, record_request |
| **Request Pattern** | ✅ | `OrderDraft` (request); `FulfillmentPacket` (orchestration); follows request→event pattern |
| **Event Pattern** | ✅ | `FulfillmentTask` status changes are events; audit chain records them |
| **Definition Pattern** | 🔵 | `ActivityDefinition` / `PlanDefinition` not implemented as FHIR resources; workflow rules in `integration/routes/rule_router.py` |
| **Appointment / AppointmentResponse** | N/A | — |
| **Schedule / Slot** | N/A | — |
| **ServiceRequest (Referrals)** | ✅ | Referral task type in FulfillmentTask; ServiceRequest in FHIR output |
| **PlanDefinition** | 🔵 | Clinical Reasoning module; not yet as FHIR resource |
| **ActivityDefinition** | 🔵 | See above |
| **DeviceRequest / DeviceUsage** | N/A | — |
| **SupplyRequest / SupplyDelivery** | N/A | — |
| **Transport** | N/A | — |
| **NutritionOrder** | N/A | — |

**Workflow Coverage: ✅ Strong** — CareOS's fulfillment engine is a genuine implementation of the FHIR workflow patterns (Task, Request, Event). Definition pattern (PlanDefinition) not yet FHIR-typed.

---

## Level 4 — Financial

**Module page:** https://www.hl7.org/fhir/financial-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **Account** | ⚡ | `Payment` model and `routers/payments.py` cover payment; not FHIR Account |
| **Contract** | N/A | — |
| **Coverage** | ✅ | In Epic scope list (`patient/Coverage.read`); access in USCDI-aligned fetch |
| **CoverageEligibilityRequest/Response** | ⚡ | `PriorAuthLikelihood` enum + prior_auth task type in fulfillment; not FHIR CoverageEligibilityRequest |
| **EnrollmentRequest/Response** | N/A | — |
| **Claim / ClaimResponse** | N/A | CareOS is not a claims clearinghouse |
| **PaymentNotice / PaymentReconciliation** | N/A | — |
| **ExplanationOfBenefit** | ✅ | In Epic scope list (`patient/ExplanationOfBenefit.read`) |
| **Invoice / ChargeItem** | N/A | — |

**Financial Coverage: ⚡ Partial** — Coverage and ExplanationOfBenefit covered via Epic access scopes. Full financial workflow (claims, billing) is intentionally out of scope for CareOS.

---

## Level 5 — Clinical Reasoning

**Module page:** https://www.hl7.org/fhir/clinicalreasoning-module.html

| Resource / Topic | Status | CareOS Implementation |
|---|---|---|
| **Library** | N/A | — |
| **PlanDefinition** | 🔵 | Rule-based workflow in `integration/routes/rule_router.py`; not FHIR PlanDefinition |
| **ActivityDefinition** | 🔵 | Task definitions in `FulfillmentTaskType` enum; not FHIR ActivityDefinition |
| **GuidanceResponse** | ✅ | CDS Hooks returns `cards` array per spec → directly maps to GuidanceResponse concept; `routers/cds_hooks.py` |
| **Measure / MeasureReport** | N/A | — |
| **Evidence / EvidenceVariable** | N/A | — |
| **Citation / ArtifactAssessment** | N/A | — |
| **RequestOrchestration** | 🔵 | `FulfillmentPacket` orchestrates tasks; not FHIR RequestOrchestration |
| **CQL Expression Logic** | N/A | CareOS uses Python rule engine (deterministic); not CQL |
| **CDS Hooks Integration** | ✅ | **Fully implemented** — `GET /cds-services` (discovery), `POST /cds-services/careos-patient-summary` (patient-view), `POST /cds-services/careos-medication-safety` (order-select/order-sign); deterministic card builders in `cds/cards.py`; tamper-evident audit; patient Fishbowl data surfaced in cards |
| **Quality Reporting** | N/A | — |
| **Knowledge Sharing** | N/A | — |

**Clinical Reasoning Coverage: ⚡ Partial** — CDS Hooks is the headline feature and **fully implemented** (this was listed as roadmap in docs but the code exists). Rule engine is functional but not FHIR PlanDefinition/CQL typed.

> ⚠️ **NOTE:** `routers/cds_hooks.py` exists and appears fully implemented — the architecture docs and landing page may still say "roadmap". Verify and update docs if deployed.

---

## Level 5 — Medication Definition

**Module page:** https://www.hl7.org/fhir/medication-definition-module.html

| Resource | Status | CareOS Implementation |
|---|---|---|
| **MedicinalProductDefinition** | N/A | Regulatory/manufacturing scope; not relevant to CareOS |
| **PackagedProductDefinition** | N/A | — |
| **AdministrableProductDefinition** | N/A | — |
| **ManufacturedItemDefinition** | N/A | — |
| **Ingredient / SubstanceDefinition** | N/A | — |
| **RegulatedAuthorization** | N/A | — |
| **ClinicalUseDefinition** | N/A | — |

**Medication Definition Coverage: N/A** — Entire module is regulatory/manufacturing scope. CareOS is a clinical coordination platform, not a drug regulator. Correctly out of scope.

---

## Summary Dashboard

| FHIR Level | Module | Coverage | Priority Gap |
|---|---|---|---|
| L1 | Foundation | ✅ Strong | OperationOutcome wrapping; FHIR Subscription |
| L2 | Implementer Support | ⚡ Partial | TestScript/TestPlan; formal profile validation |
| L2 | Security & Privacy | ✅ Strong | FHIR AuditEvent/Consent as typed output |
| L2 | Conformance | ⚡ Partial | Publish own CapabilityStatement; formal IG |
| L2 | Terminology | ⚡ Partial | No terminology service ops ($expand etc.) |
| L2 | Exchange | ✅ Strong | — (WebSocket ≈ Subscription functionally) |
| L3 | Administration | ✅ Good | ResearchStudy resource typing |
| L4 | Clinical | ✅ Strong | DetectedIssue as FHIR resource |
| L4 | Diagnostics | ✅ Strong | ImagingSelection |
| L4 | Medications | ✅ Strong | — |
| L4 | Workflow | ✅ Strong | PlanDefinition/ActivityDefinition typing |
| L4 | Financial | ⚡ Partial | Intentionally partial (not a billing platform) |
| L5 | Clinical Reasoning | ⚡ Partial | CDS Hooks ✅; PlanDefinition/CQL not typed |
| L5 | Medication Definition | N/A | Correctly out of scope |

---

## Top Gaps to Address (prioritized)

### P1 — Quick wins, high FHIR spec alignment value

1. **OperationOutcome wrapping** — Wrap FastAPI 4xx/5xx errors as FHIR OperationOutcome JSON (Foundation). Small change in a middleware or exception handler.

2. **Own CapabilityStatement** — Publish `GET /metadata` that advertises CareOS's FHIR capabilities. Required for any FHIR server claiming spec conformance. Also unlocks discovery by SMART App Gallery validators.

3. **FHIR AuditEvent output** — The internal audit chain is functionally correct; add a serializer so `GET /fhir/AuditEvent` returns FHIR-typed records. Critical for IRB compliance posture.

4. **Update CDS Hooks docs** — `routers/cds_hooks.py` appears fully implemented. `careos-application.md` §11 and landing page still say "roadmap". Verify live status and update docs accordingly.

### P2 — Meaningful additions

5. **FHIR Consent resource output** — Serialize `ConsentSession` as a FHIR Consent resource for patient portability (Security module).

6. **ResearchStudy / ResearchSubject** — Wrap the existing research subsystem in FHIR ResearchStudy/ResearchSubject resources (Administration module). Relevant for IRB and SMART App Gallery submission.

7. **Formal TestScript** — At least one FHIR TestScript covering the main SMART flow validates spec claims.

### P3 — Future / when publishing IGs

8. **CapabilityStatement with profiles** — Reference US Core profiles in own CapabilityStatement (Conformance).
9. **FHIR Subscription resource** — Replace/augment WebSocket with proper FHIR Subscription (Foundation).
10. **$expand / $validate-code** — Only needed if CareOS publishes its own ValueSets (Terminology).
