# FHIR R5 Modules Map
> Source: https://www.hl7.org/fhir/modules.html (R5 — v5.0.0)
> Scraped: Jun 30, 2026

---

## Overview

FHIR is organized into **12 modules** across **5 levels** of abstraction. Dependencies flow primarily **downward** (lower levels must be understood first), with some **horizontal** dependencies between sibling modules.

```
LEVEL 1 — Basic Framework
  └── Foundation

LEVEL 2 — Supporting Implementation
  ├── Implementer Support
  ├── Security & Privacy
  ├── Conformance
  ├── Terminology
  └── Exchange

LEVEL 3 — Real-World Concepts
  └── Administration

LEVEL 4 — Record-Keeping & Data Exchange
  ├── Clinical
  ├── Diagnostics
  ├── Medications
  ├── Workflow
  └── Financial

LEVEL 5 — Reasoning
  ├── Clinical Reasoning
  └── Medication Definition
```

---

## Level 1 — Infrastructure

### Foundation Module
**URL:** https://www.hl7.org/fhir/foundation-module.html
**Section:** 2.0 | **Status:** Informative

The base layer every implementer touches, regardless of use case. Contains the core documentation and universal resource types.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Framework** | [Resource](https://www.hl7.org/fhir/resource.html), [DomainResource](https://www.hl7.org/fhir/domainresource.html), [Basic](https://www.hl7.org/fhir/basic.html), [Binary](https://www.hl7.org/fhir/binary.html), [Bundle](https://www.hl7.org/fhir/bundle.html) |
| **Content Management** | [Questionnaire](https://www.hl7.org/fhir/questionnaire.html), [QuestionnaireResponse](https://www.hl7.org/fhir/questionnaireresponse.html), [List](https://www.hl7.org/fhir/list.html), [Composition](https://www.hl7.org/fhir/composition.html), [DocumentReference](https://www.hl7.org/fhir/documentreference.html) |
| **Data Exchange** | [OperationOutcome](https://www.hl7.org/fhir/operationoutcome.html), [Parameters](https://www.hl7.org/fhir/parameters.html), [Subscription](https://www.hl7.org/fhir/subscription.html), [SubscriptionStatus](https://www.hl7.org/fhir/subscriptionstatus.html), [SubscriptionTopic](https://www.hl7.org/fhir/subscriptiontopic.html), [MessageHeader](https://www.hl7.org/fhir/messageheader.html) |
| **Documentation** | [documentation.html](https://www.hl7.org/fhir/documentation.html) |

#### Relationships to Other Modules
- **All other modules depend on Foundation** (universal base)
- → Exchange (builds exchange methods on top of foundation resources)
- → Terminology (provides formal code system bindings for definitions)
- → Conformance (extends foundation for local/national use)
- → Security & Privacy (links to external security standards)
- → Implementer Support (adds testing and reference implementations)

#### Normative Status
| Status | Resources |
|---|---|
| **Normative (stable)** | Resource, DomainResource, Binary, Bundle, Parameters, OperationOutcome |
| **Stable, some trial features** | Questionnaire, QuestionnaireResponse, List, DocumentReference |
| **Redesigned, trial use** | Subscription, SubscriptionStatus, SubscriptionTopic |
| **Not widely used** | Basic, MessageHeader |

---

## Level 2 — Supporting Implementation

### Implementer Support Module
**URL:** https://www.hl7.org/fhir/implsupport-module.html
**Section:** 7.0

Practical resources for developers, testers, and profilers. Focused on tooling, validation, and community resources rather than data models.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Testing** | [Testing FHIR](https://www.hl7.org/fhir/testing.html), [TestPlan](https://www.hl7.org/fhir/testplan.html), [TestScript](https://www.hl7.org/fhir/testscript.html), [TestReport](https://www.hl7.org/fhir/testreport.html) |
| **Requirements** | [Requirements](https://www.hl7.org/fhir/requirements.html), [ActorDefinition](https://www.hl7.org/fhir/actordefinition.html) |
| **Validation** | [Validating Resources](https://www.hl7.org/fhir/validation.html) |
| **Mapping** | [Mapping Language](https://www.hl7.org/fhir/mapping-language.html), [Mapping Tutorial](https://www.hl7.org/fhir/mapping-tutorial.html), [StructureMap](https://www.hl7.org/fhir/structuremap.html) |
| **Developer Guidance** | [FHIRPath](https://www.hl7.org/fhir/fhirpath.html), [Clinical Safety](https://www.hl7.org/fhir/safety.html), [Managing Resource Identity](https://www.hl7.org/fhir/managing.html), [Interaction Patterns](https://www.hl7.org/fhir/pushpull.html), [Update Rules](https://www.hl7.org/fhir/updates.html) |
| **EHR Context** | [How FHIR Fits into an EHR](https://www.hl7.org/fhir/ehr-fm.html), [Common Use Cases](https://www.hl7.org/fhir/usecases.html), [ExampleScenario](https://www.hl7.org/fhir/examplescenario.html), [Clinical Examples](https://www.hl7.org/fhir/integrated-examples.html) |
| **Versioning** | [Version Management Policy](https://www.hl7.org/fhir/versions.html) |
| **Comparisons** | [v2](https://www.hl7.org/fhir/comparison-v2.html), [v3 Messaging](https://www.hl7.org/fhir/comparison-v3.html), [CDA](https://www.hl7.org/fhir/comparison-cda.html), [CDA on FHIR](https://www.hl7.org/fhir/cda-intro.html), [Other Specs](https://www.hl7.org/fhir/comparison-other.html) |
| **Downloads** | [Downloads Page](https://www.hl7.org/fhir/downloads.html) |
| **Community** | [FHIR Chat / Zulip](http://chat.fhir.org/), [FHIR Forum](http://community.fhir.org/), [StackOverflow (hl7_fhir)](http://stackoverflow.com/questions/tagged/hl7_fhir) |

#### Relationships to Other Modules
- Builds on → Foundation
- References → Conformance (for profiling tools)
- References → Security & Privacy (for general considerations)

---

### Security & Privacy Module
**URL:** https://www.hl7.org/fhir/secpriv-module.html
**Section:** 6.0

Covers access control, consent, audit logging, and provenance. FHIR does not mandate a single security approach — it provides building blocks.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Resources** | [AuditEvent](https://www.hl7.org/fhir/auditevent.html), [Consent](https://www.hl7.org/fhir/consent.html), [Permission](https://www.hl7.org/fhir/permission.html), [Provenance](https://www.hl7.org/fhir/provenance.html) |
| **Data Type** | [Signature](https://www.hl7.org/fhir/datatypes.html) |
| **Documentation** | [Security Principles](https://www.hl7.org/fhir/security.html), [Security Labels](https://www.hl7.org/fhir/security-labels.html), [Signatures](https://www.hl7.org/fhir/signatures.html) |

#### Key Use Cases Covered (within module page)
- Authorization and Access Control
- Authorization with Query Parameters
- User Identity and Access Context
- Audit Logging
- Accounting of Disclosures
- Privacy Consent
- Provenance
- Digital/Electronic Signatures
- De-Identification, Anonymization, Pseudonymization
- Security on Test Data
- Privacy Risks from Exposing Links

#### Relationships to Other Modules
- Depended upon by ALL other modules (cross-cutting concern)
- Especially referenced by: Exchange, Administration, Clinical, Diagnostics, Medications

---

### Conformance Module
**URL:** https://www.hl7.org/fhir/conformance-module.html
**Section:** 5.0

Describes how FHIR is adapted and constrained for specific jurisdictions, institutions, or use cases. The "profiling" layer.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Core Resources** | [StructureDefinition](https://www.hl7.org/fhir/structuredefinition.html), [CapabilityStatement](https://www.hl7.org/fhir/capabilitystatement.html), [ImplementationGuide](https://www.hl7.org/fhir/implementationguide.html) |
| **Message / Operation** | [MessageDefinition](https://www.hl7.org/fhir/messagedefinition.html), [OperationDefinition](https://www.hl7.org/fhir/operationdefinition.html) |
| **Search / Compartments** | [SearchParameter](https://www.hl7.org/fhir/searchparameter.html), [CompartmentDefinition](https://www.hl7.org/fhir/compartmentdefinition.html) |
| **Naming** | [NamingSystem](https://www.hl7.org/fhir/namingsystem.html) |
| **Cross-module (dotted)** | [ValueSet](https://www.hl7.org/fhir/valueset.html) *(Terminology)*, [ConceptMap](https://www.hl7.org/fhir/conceptmap.html) *(Terminology)*, [StructureMap](https://www.hl7.org/fhir/structuremap.html) *(Impl Support)*, [TestScript](https://www.hl7.org/fhir/testscript.html) *(Impl Support)* |
| **Documentation** | [Conformance Rules](https://www.hl7.org/fhir/conformance-rules.html), [Extensibility](https://www.hl7.org/fhir/extensibility.html), [Operations](https://www.hl7.org/fhir/operations.html), [Profiling](https://www.hl7.org/fhir/profiling.html) |

#### Relationships to Other Modules
- Depends on → Foundation (extends it)
- Cross-references → Terminology (ValueSet bindings in StructureDefinitions)
- Cross-references → Implementer Support (TestScript, StructureMap)

---

### Terminology Module
**URL:** https://www.hl7.org/fhir/terminology-module.html
**Section:** 4.0

Manages coded data throughout FHIR — code systems, value sets, concept maps, and the terminology service.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Resources** | [CodeSystem](https://www.hl7.org/fhir/codesystem.html), [ValueSet](https://www.hl7.org/fhir/valueset.html), [ConceptMap](https://www.hl7.org/fhir/conceptmap.html), [NamingSystem](https://www.hl7.org/fhir/namingsystem.html), [TerminologyCapabilities](https://www.hl7.org/fhir/terminologycapabilities.html) |
| **Terminology Service** | [Terminology Service Documentation](https://www.hl7.org/fhir/terminology-service.html) |
| **CodeSystem Operations** | [$lookup](https://www.hl7.org/fhir/codesystem-operation-lookup.html), [$validate-code](https://www.hl7.org/fhir/codesystem-operation-validate-code.html), [$subsumes](https://www.hl7.org/fhir/codesystem-operation-subsumes.html), [$find-matches](https://www.hl7.org/fhir/codesystem-operation-find-matches.html) |
| **ValueSet Operations** | [$expand](https://www.hl7.org/fhir/valueset-operation-expand.html), [$validate-code](https://www.hl7.org/fhir/valueset-operation-validate-code.html) |
| **ConceptMap Operations** | [$translate](https://www.hl7.org/fhir/conceptmap-operation-translate.html), [$closure](https://www.hl7.org/fhir/conceptmap-operation-closure.html) |
| **Coded Datatypes** | [code](https://www.hl7.org/fhir/datatypes.html), [Coding](https://www.hl7.org/fhir/datatypes.html), [CodeableConcept](https://www.hl7.org/fhir/datatypes.html) |
| **Documentation** | [Using Codes in Resources](https://www.hl7.org/fhir/terminologies.html), [Code Systems in FHIR](https://www.hl7.org/fhir/terminologies-systems.html), [Value Sets in FHIR](https://www.hl7.org/fhir/terminologies-valuesets.html), [Concept Map Mappings](https://www.hl7.org/fhir/terminologies-conceptmaps.html), [Known Identifier Systems](https://www.hl7.org/fhir/identifier-registry.html) |

#### Relationships to Other Modules
- Depends on → Foundation
- Used by → Conformance (ValueSet bindings in StructureDefinitions)
- Used by → ALL clinical modules (coded data everywhere)

---

### Exchange Module
**URL:** https://www.hl7.org/fhir/exchange-module.html
**Section:** 3.0

Defines the **how** of data exchange — the six recognized methods for moving FHIR resources between systems.

#### Sub-pages / Child Links
| Exchange Method | Documentation Page |
|---|---|
| **RESTful API** | [HTTP API](https://www.hl7.org/fhir/http.html), [Search](https://www.hl7.org/fhir/search.html), [Operations](https://www.hl7.org/fhir/operations.html), [GraphQL](https://www.hl7.org/fhir/graphql.html), [Async](https://www.hl7.org/fhir/async.html) |
| **Messaging** | [Messaging Framework](https://www.hl7.org/fhir/messaging.html) |
| **Documents** | Uses [Composition](https://www.hl7.org/fhir/composition.html) as wrapper |
| **Services / SOA** | [Services Framework](https://www.hl7.org/fhir/services.html) |
| **Database / Storage** | [Storage](https://www.hl7.org/fhir/storage.html) |
| **Subscriptions** | [Subscriptions](https://www.hl7.org/fhir/subscriptions.html), [Subscription](https://www.hl7.org/fhir/subscription.html), [SubscriptionTopic](https://www.hl7.org/fhir/subscriptiontopic.html) |
| **Choosing a Pattern** | [Approaches to Exchanging FHIR Data](https://www.hl7.org/fhir/exchanging.html) |
| **Security** | [Security Page](https://www.hl7.org/fhir/security.html), [SMART App Launch](http://hl7.org/fhir/smart-app-launch/) |

#### Relationships to Other Modules
- Builds on → Foundation (resource definitions)
- References → Security & Privacy (all exchange must be secured)
- References → Conformance (CapabilityStatement advertises exchange capabilities)

---

## Level 3 — Real-World Concepts

### Administration Module
**URL:** https://www.hl7.org/fhir/administration-module.html
**Section:** 8.0

Real-world entities — patients, practitioners, organizations, locations, devices. The "who and where" of healthcare. Nearly all clinical resources reference back to these.

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Patient Registers** | [Patient](https://www.hl7.org/fhir/patient.html), [RelatedPerson](https://www.hl7.org/fhir/relatedperson.html), [Person](https://www.hl7.org/fhir/person.html), [Group](https://www.hl7.org/fhir/group.html) |
| **Workforce** | [Practitioner](https://www.hl7.org/fhir/practitioner.html), [PractitionerRole](https://www.hl7.org/fhir/practitionerrole.html) |
| **Organizations** | [Organization](https://www.hl7.org/fhir/organization.html), [Location](https://www.hl7.org/fhir/location.html), [HealthcareService](https://www.hl7.org/fhir/healthcareservice.html), [Endpoint](https://www.hl7.org/fhir/endpoint.html) |
| **Scheduling** | [Schedule](https://www.hl7.org/fhir/schedule.html), [Slot](https://www.hl7.org/fhir/slot.html), [Appointment](https://www.hl7.org/fhir/appointment.html), [AppointmentResponse](https://www.hl7.org/fhir/appointmentresponse.html) |
| **Encounters** | [EpisodeOfCare](https://www.hl7.org/fhir/episodeofcare.html), [Encounter](https://www.hl7.org/fhir/encounter.html), [EncounterHistory](https://www.hl7.org/fhir/encounterhistory.html) |
| **Flags & Definitions** | [Flag](https://www.hl7.org/fhir/flag.html), [ObservationDefinition](https://www.hl7.org/fhir/observationdefinition.html), [SpecimenDefinition](https://www.hl7.org/fhir/specimendefinition.html) |
| **Devices & Products** | [Device](https://www.hl7.org/fhir/device.html), [DeviceDefinition](https://www.hl7.org/fhir/devicedefinition.html), [DeviceMetric](https://www.hl7.org/fhir/devicemetric.html), [BiologicallyDerivedProduct](https://www.hl7.org/fhir/biologicallyderivedproduct.html), [NutritionProduct](https://www.hl7.org/fhir/nutritionproduct.html) |
| **Substances & Inventory** | [Substance](https://www.hl7.org/fhir/substance.html), [InventoryItem](https://www.hl7.org/fhir/inventoryitem.html) |
| **Billing (admin)** | [Account](https://www.hl7.org/fhir/account.html) |

#### Relationships to Other Modules
- Depends on → Foundation, Terminology
- Referenced by → ALL Level 4 modules (Patient, Practitioner, Organization appear in nearly every clinical resource)
- Cross-references → Workflow (Appointment/Schedule/Slot also appear in Workflow)
- Cross-references → Financial (Account)

---

## Level 4 — Record-Keeping & Data Exchange

### Clinical Module
**URL:** https://www.hl7.org/fhir/clinicalsummary-module.html
**Section:** 9.0

Core clinical information documented during patient care. Excludes diagnostics (see Diagnostics Module) and medications (see Medications Module).

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Problems & History** | [AllergyIntolerance](https://www.hl7.org/fhir/allergyintolerance.html), [Condition](https://www.hl7.org/fhir/condition.html), [Procedure](https://www.hl7.org/fhir/procedure.html), [FamilyMemberHistory](https://www.hl7.org/fhir/familymemberhistory.html), [AdverseEvent](https://www.hl7.org/fhir/adverseevent.html) |
| **Care Planning** | [CarePlan](https://www.hl7.org/fhir/careplan.html), [Goal](https://www.hl7.org/fhir/goal.html), [CareTeam](https://www.hl7.org/fhir/careteam.html) |
| **Assessment** | [ClinicalImpression](https://www.hl7.org/fhir/clinicalimpression.html), [DetectedIssue](https://www.hl7.org/fhir/detectedissue.html), [RiskAssessment](https://www.hl7.org/fhir/riskassessment.html) |
| **Orders & Prescriptions** | [ServiceRequest](https://www.hl7.org/fhir/servicerequest.html), [VisionPrescription](https://www.hl7.org/fhir/visionprescription.html) |
| **Nutrition** | [NutritionIntake](https://www.hl7.org/fhir/nutritionintake.html), [NutritionOrder](https://www.hl7.org/fhir/nutritionorder.html) |

#### Relationships to Other Modules
- Depends on → Foundation, Administration (Patient, Practitioner, Encounter refs)
- References → Security & Privacy (patient data — high sensitivity)
- References → Medications Module (for medication-related info)
- References → Diagnostics Module (for observation-based data)

---

### Diagnostics Module
**URL:** https://www.hl7.org/fhir/diagnostics-module.html
**Section:** 10.0

Ordering and reporting of clinical diagnostics — lab tests, imaging, and genomics.

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Core** | [Observation](https://www.hl7.org/fhir/observation.html), [DiagnosticReport](https://www.hl7.org/fhir/diagnosticreport.html) |
| **Ordering** | [ServiceRequest](https://www.hl7.org/fhir/servicerequest.html) |
| **Documents** | [DocumentReference](https://www.hl7.org/fhir/documentreference.html) |
| **Imaging** | [ImagingStudy](https://www.hl7.org/fhir/imagingstudy.html), [ImagingSelection](https://www.hl7.org/fhir/imagingselection.html) |
| **Genomics** | [MolecularSequence](https://www.hl7.org/fhir/molecularsequence.html), [GenomicStudy](https://www.hl7.org/fhir/genomicstudy.html) |
| **Specimens** | [Specimen](https://www.hl7.org/fhir/specimen.html), [BodyStructure](https://www.hl7.org/fhir/bodystructure.html) |
| **Documentation** | [Genomics Implementation Guidance](https://www.hl7.org/fhir/genomics.html) |

#### Relationships to Other Modules
- Depends on → Foundation, Administration
- Cross-references → Workflow (ordering/fulfillment coordination)
- Referenced by → Clinical (observations inform clinical summaries)

---

### Medications Module
**URL:** https://www.hl7.org/fhir/medications-module.html
**Section:** 11.0

Three domains: medication ordering/dispensing/administration, immunizations, and drug knowledge/formularies.

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Medication Lifecycle** | [MedicationRequest](https://www.hl7.org/fhir/medicationrequest.html) *(prescribing)*, [MedicationDispense](https://www.hl7.org/fhir/medicationdispense.html), [MedicationAdministration](https://www.hl7.org/fhir/medicationadministration.html), [MedicationStatement](https://www.hl7.org/fhir/medicationstatement.html) |
| **Drug Data** | [Medication](https://www.hl7.org/fhir/medication.html), [MedicationKnowledge](https://www.hl7.org/fhir/medicationknowledge.html), [FormularyItem](https://www.hl7.org/fhir/formularyitem.html) |
| **Immunizations** | [Immunization](https://www.hl7.org/fhir/immunization.html), [ImmunizationEvaluation](https://www.hl7.org/fhir/immunizationevaluation.html), [ImmunizationRecommendation](https://www.hl7.org/fhir/immunizationrecommendation.html) |

#### Relationships to Other Modules
- Depends on → Foundation, Administration (Patient, Practitioner)
- Cross-references → Workflow (MedicationRequest follows generic FHIR workflow patterns)
- Distinct from → Medication Definition Module (that covers regulatory/manufacturing detail, not day-to-day prescribing)

---

### Workflow Module
**URL:** https://www.hl7.org/fhir/workflow-module.html
**Section:** 12.0

Coordination of activities — requests, tasks, protocols, scheduling, referrals. The "how things get done" layer.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Core** | [Workflow Overview](https://www.hl7.org/fhir/workflow.html), [Task](https://www.hl7.org/fhir/task.html) |
| **Patterns** | [Definition](https://www.hl7.org/fhir/definition.html), [Request](https://www.hl7.org/fhir/request.html), [Event](https://www.hl7.org/fhir/event.html) |
| **Communication Docs** | [Communication Patterns](https://www.hl7.org/fhir/workflow-communications.html), [Ad-Hoc Patterns](https://www.hl7.org/fhir/workflow-ad-hoc.html), [Management Patterns](https://www.hl7.org/fhir/workflow-management.html), [Examples](https://www.hl7.org/fhir/workflow-examples.html) |
| **Scheduling** | [Appointment](https://www.hl7.org/fhir/appointment.html), [AppointmentResponse](https://www.hl7.org/fhir/appointmentresponse.html), [Schedule](https://www.hl7.org/fhir/schedule.html), [Slot](https://www.hl7.org/fhir/slot.html) |
| **Referrals & Orders** | [ServiceRequest](https://www.hl7.org/fhir/servicerequest.html), [NutritionOrder](https://www.hl7.org/fhir/nutritionorder.html), [VisionPrescription](https://www.hl7.org/fhir/visionprescription.html) |
| **Definitions** | [ActivityDefinition](https://www.hl7.org/fhir/activitydefinition.html), [PlanDefinition](https://www.hl7.org/fhir/plandefinition.html) |
| **Devices & Supply** | [DeviceRequest](https://www.hl7.org/fhir/devicerequest.html), [DeviceUsage](https://www.hl7.org/fhir/deviceusage.html), [DeviceDispense](https://www.hl7.org/fhir/devicedispense.html), [DeviceAssociation](https://www.hl7.org/fhir/deviceassociation.html), [BiologicallyDerivedProductDispense](https://www.hl7.org/fhir/biologicallyderivedproductdispense.html), [SupplyRequest](https://www.hl7.org/fhir/supplyrequest.html), [SupplyDelivery](https://www.hl7.org/fhir/supplydelivery.html), [Transport](https://www.hl7.org/fhir/transport.html) |
| **Inventory** | [InventoryItem](https://www.hl7.org/fhir/inventoryitem.html), [InventoryReport](https://www.hl7.org/fhir/inventoryreport.html) |

#### Relationships to Other Modules
- Depends on → Foundation, Administration
- Coordinates → Diagnostics (ordering/fulfilling lab work)
- Coordinates → Medications (MedicationRequest fulfillment)
- Coordinates → Financial (authorization/pre-auth flows)
- Used by → Clinical Reasoning (PlanDefinition, ActivityDefinition shared)

---

### Financial Module
**URL:** https://www.hl7.org/fhir/financial-module.html
**Section:** 13.0

Billing, claims, coverage, eligibility, payments, and contracts between providers, insurers, and patients.

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Administrative Support** | [Account](https://www.hl7.org/fhir/account.html), [Contract](https://www.hl7.org/fhir/contract.html), [Coverage](https://www.hl7.org/fhir/coverage.html), [CoverageEligibilityRequest](https://www.hl7.org/fhir/coverageeligibilityrequest.html), [CoverageEligibilityResponse](https://www.hl7.org/fhir/coverageeligibilityresponse.html), [EnrollmentRequest](https://www.hl7.org/fhir/enrollmentrequest.html), [EnrollmentResponse](https://www.hl7.org/fhir/enrollmentresponse.html), [VisionPrescription](https://www.hl7.org/fhir/visionprescription.html) |
| **Billing / Claims** | [Claim](https://www.hl7.org/fhir/claim.html), [ClaimResponse](https://www.hl7.org/fhir/claimresponse.html) |
| **Payment** | [PaymentNotice](https://www.hl7.org/fhir/paymentnotice.html), [PaymentReconciliation](https://www.hl7.org/fhir/paymentreconciliation.html) |
| **Patient Reporting** | [ExplanationOfBenefit](https://www.hl7.org/fhir/explanationofbenefit.html) |

#### Key Patterns Documented
- Relative order of use (eligibility → pre-auth → claim → adjudication → payment)
- Resource status life-cycles
- Attachments / supporting information
- Subrogation (insurer-to-insurer cost recovery)
- Coordination of Benefits (multiple coverages)
- Batch processing
- Real-time eClaims
- 3-tier line item hierarchy
- Tax handling

#### Relationships to Other Modules
- Depends on → Foundation, Administration (Patient, Practitioner, Organization)
- Cross-references → Workflow (authorization/pre-auth patterns)

---

## Level 5 — Reasoning

### Clinical Reasoning Module
**URL:** https://www.hl7.org/fhir/clinicalreasoning-module.html
**Section:** 14.0

Representation, distribution, and evaluation of clinical knowledge artifacts — CDS rules, quality measures, order sets, protocols, evidence.

#### Sub-pages / Child Links
| Category | Resources / Pages |
|---|---|
| **Core Resources** | [ActivityDefinition](https://www.hl7.org/fhir/activitydefinition.html), [PlanDefinition](https://www.hl7.org/fhir/plandefinition.html), [Library](https://www.hl7.org/fhir/library.html), [Measure](https://www.hl7.org/fhir/measure.html), [MeasureReport](https://www.hl7.org/fhir/measurereport.html), [GuidanceResponse](https://www.hl7.org/fhir/guidanceresponse.html), [RequestOrchestration](https://www.hl7.org/fhir/requestorchestration.html) |
| **Evidence** | [Evidence](https://www.hl7.org/fhir/evidence.html), [EvidenceVariable](https://www.hl7.org/fhir/evidencevariable.html), [Citation](https://www.hl7.org/fhir/citation.html), [ArtifactAssessment](https://www.hl7.org/fhir/artifactassessment.html) |
| **Profiles** | [Shareable ActivityDefinition](https://www.hl7.org/fhir/shareableactivitydefinition.html), [Shareable Library](https://www.hl7.org/fhir/shareablelibrary.html), [CQL Library](https://www.hl7.org/fhir/cqllibrary.html), [Shareable Measure](https://www.hl7.org/fhir/shareablemeasure.html), [Shareable PlanDefinition](https://www.hl7.org/fhir/shareableplandefinition.html), [Computable PlanDefinition](https://www.hl7.org/fhir/computableplandefinition.html), [CDS Hooks GuidanceResponse](https://www.hl7.org/fhir/cdshooksguidanceresponse.html), [CDS Hooks RequestOrchestration](https://www.hl7.org/fhir/cdshooksrequestorchestration.html) |
| **Services** | [Knowledge Repository](https://www.hl7.org/fhir/capabilitystatement-knowledge-repository.html), [Measure Processor](https://www.hl7.org/fhir/capabilitystatement-measure-processor.html) |
| **Topic Pages** | [Using Expressions](https://www.hl7.org/fhir/clinicalreasoning-topics-using-expressions.html), [Definitional Resources](https://www.hl7.org/fhir/clinicalreasoning-topics-definitional-resources.html), [Knowledge Artifact Representation](https://www.hl7.org/fhir/clinicalreasoning-knowledge-artifact-representation.html), [Knowledge Artifact Distribution](https://www.hl7.org/fhir/clinicalreasoning-knowledge-artifact-distribution.html), [CDS on FHIR](https://www.hl7.org/fhir/clinicalreasoning-cds-on-fhir.html), [Quality Reporting](https://www.hl7.org/fhir/clinicalreasoning-quality-reporting.html), [Evidence & Statistics](https://www.hl7.org/fhir/clinicalreasoning-evidence-and-statistics.html) |
| **Expression Languages** | [FHIRPath](http://hl7.org/fhirpath), [CQL](http://cql.hl7.org) |
| **CDS Integration** | [CDS Hooks](https://cds-hooks.hl7.org/) |

#### Audiences
- **Knowledge Authors** — representing artifacts in FHIR
- **Content Providers** — FHIR server as knowledge repository
- **Evaluation Service Providers** — quality measures, CDS Hooks services
- **Evaluation Service Consumers** — calling CDS services

#### Relationships to Other Modules
- Depends on → ALL lower modules
- Shares resources with → Workflow (ActivityDefinition, PlanDefinition)
- Consumes → ALL clinical data (Clinical, Diagnostics, Medications, Administration)
- Exposes → CDS Hooks services for EHR integration

---

### Medication Definition Module
**URL:** https://www.hl7.org/fhir/medication-definition-module.html
**Section:** 15.0

Regulatory and manufacturing-level drug definitions — not for day-to-day prescribing (see Medications Module for that). Used by regulators, pharmacopoeias, drug catalogs.

#### Sub-pages / Child Links
| Category | Resources |
|---|---|
| **Product** | [MedicinalProductDefinition](https://www.hl7.org/fhir/medicinalproductdefinition.html) |
| **Packaging** | [PackagedProductDefinition](https://www.hl7.org/fhir/packagedproductdefinition.html), [ManufacturedItemDefinition](https://www.hl7.org/fhir/manufactureditemdefinition.html), [AdministrableProductDefinition](https://www.hl7.org/fhir/administrableproductdefinition.html) |
| **Ingredients & Substances** | [Ingredient](https://www.hl7.org/fhir/ingredient.html), [SubstanceDefinition](https://www.hl7.org/fhir/substancedefinition.html) |
| **Clinical Use** | [ClinicalUseDefinition](https://www.hl7.org/fhir/clinicalusedefinition.html) |
| **Authorization** | [RegulatedAuthorization](https://www.hl7.org/fhir/regulatedauthorization.html) |

#### Three-Level Product Model
```
MedicinalProductDefinition (product)
  └── PackagedProductDefinition (package/pack type)
        └── ManufacturedItemDefinition (physical item, e.g. tablet)
              └── AdministrableProductDefinition (ready-to-administer form)
```

#### Relationships to Other Modules
- Distinct from → Medications Module (`Medication` resource = day-to-day prescribing; `MedicinalProductDefinition` = regulatory detail)
- References → Administration (`DeviceDefinition` for co-packaged devices)

---

## Cross-Module Relationship Summary

```
                        FOUNDATION (L1)
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   IMPL SUPPORT        SECURITY &         TERMINOLOGY
       (L2)            PRIVACY (L2)          (L2)
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                      CONFORMANCE (L2) ←── (binds Terminology + Foundation)
                             │
                      EXCHANGE (L2)   ←── (REST/Msg/Doc/Sub/Storage)
                             │
                    ADMINISTRATION (L3)
                    (Patient, Practitioner,
                     Organization, Device...)
                             │
        ┌────────────────────┼────────────────────┐
        │           │        │        │            │
    CLINICAL    DIAGNOSTICS  MEDS  WORKFLOW    FINANCIAL
      (L4)        (L4)       (L4)    (L4)        (L4)
        │           │        │        │
        └───────────┴────────┴────────┘
                             │
                    ┌────────┴────────┐
              CLINICAL REASONING  MED DEFINITION
                   (L5)               (L5)
```

### Key Shared Resources (appear in multiple modules)
| Resource | Modules |
|---|---|
| `ServiceRequest` | Clinical, Diagnostics, Workflow |
| `VisionPrescription` | Clinical, Workflow, Financial |
| `Appointment` / `Schedule` / `Slot` | Administration, Workflow |
| `ActivityDefinition` / `PlanDefinition` | Workflow, Clinical Reasoning |
| `Account` | Administration, Financial |
| `DocumentReference` | Foundation, Diagnostics |
| `Subscription` / `SubscriptionTopic` | Foundation, Exchange |

---

## Additional Reference Pages (from modules.html)

| Page | URL |
|---|---|
| Common Use Cases (PHR, XDS, CDS) | https://www.hl7.org/fhir/usecases.html |
| Resource Guide (inter-resource relationships) | https://www.hl7.org/fhir/resourceguide.html |
| Managing Multiple FHIR Versions | https://www.hl7.org/fhir/versioning.html |
| Specification Version Policy | https://www.hl7.org/fhir/versions.html |
| Implementation Guide Registry | http://www.fhir.org/guides/registry |
| Full Table of Contents | https://www.hl7.org/fhir/toc.html |
