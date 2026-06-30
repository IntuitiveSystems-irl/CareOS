# Epic Vendor Services / Open Epic — Enrollment Application (CareOS)

Draft answers for the Epic Vendor Services enrollment questionnaire. Items marked
**[CONFIRM]** require a factual decision from the company before submission.
Character counts are approximate; each answer is written to stay under the stated
limit.

**Company:** Business Intuitive Inc.
**Address / primary place of business:** 720 Seneca St, Seattle, WA 98101, USA
**Incorporation:** Washington State, USA

---

## 1. Tell us about your product (limit 4,000 chars)

CareOS is a HIPAA-compliant clinical operations platform that reduces
administrative burden and makes patient data portable. It runs beside the EHR as
a SMART on FHIR application and a standards-based interoperability layer — never
a screen-scraper.

Core workflows:

1. Connect. An organization registers its FHIR endpoint and authorizes CareOS via
SMART on FHIR — OAuth 2.0 authorization-code with PKCE for public clients, or
SMART Backend Services (JWT, RFC 7521/7523) for system-level access. CareOS
discovers endpoints from .well-known/smart-configuration or the FHIR
CapabilityStatement.

2. Relational chart. CareOS reads USCDI / US Core R4 resources (Patient,
Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter,
ServiceRequest, DocumentReference) and renders them two ways: a traditional
siloed/tabbed chart and a "relational" view that deterministically links records
— which medication treats which problem, which medication conflicts with which
allergy, which lab came from which encounter. This reduces clinician cognitive
load and surfaces gaps.

3. Decision support. CareOS exposes a CDS Hooks service (patient-view,
order-select, order-sign) returning deterministic, rule-derived cards: drug–
allergy conflict alerts and, uniquely, the patient's own feedback surfaced at the
point of care ("patient voice"). No large language model sits in the clinical
decision path; outputs are reproducible and fully auditable.

4. Patient mediation and transparency. Patients see a read-only "Patient
Fishbowl" of their care status and can submit preferences and concerns that flow
back to clinicians as decision-support cards, supporting 21st Century Cures Act
patient access and information-blocking compliance.

5. Operations and provenance. An HL7 v2 (MLLP) + FHIR relay normalizes inbound
messages into a canonical, envelope-encrypted (AES-256-GCM) FHIR store; workflow
agents automate intake; every PHI access is recorded in a tamper-evident,
SHA-256 hash-chained audit log.

Epic integration (current and desired). CareOS is built to Epic on FHIR. Today it
implements SMART on FHIR discovery, OAuth 2.0 authorization-code + PKCE, SMART
Backend Services, FHIR R4 reads across USCDI, Bulk Data $export, and a CDS Hooks
service. Through Vendor Services we want to register CareOS as a SMART app for
both EHR launch and standalone launch against Epic, validate against Epic's USCDI
on FHIR R4 APIs and Clinical Notes (DocumentReference + Binary), and register our
CDS Hooks endpoints so decision support — including patient-reported preferences
— renders natively in Epic's patient-view and order-entry workflows.

Intended end-users: (a) clinicians and care-team staff — physicians, nurses,
PAs/NPs, pharmacists, and care coordinators — who use the relational chart and
in-workflow CDS; (b) clinic and health-system operations staff; and (c) patients,
who control access and contribute feedback. CareOS deploys per organization and
is designed to connect to any conformant FHIR R4 EHR.

---

## 2. Affiliated Epic customer (optional)

Business Intuitive Inc.

---

## 3. Are you joining Vendor Services to request additional interoperability tech? (limit 1,000 chars)

Yes. We request access to the Epic interoperability technologies needed to
certify and run CareOS against Epic: USCDI on FHIR R4 read APIs (Patient,
Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter,
ServiceRequest, Goal, CarePlan, CareTeam, Immunization, Procedure,
DiagnosticReport); Clinical Notes (DocumentReference + Binary); SMART on FHIR app
launch (EHR and standalone) with OAuth 2.0 / PKCE; SMART Backend Services for
system-level and bulk access; FHIR Bulk Data ($export); and CDS Hooks endpoint
registration (patient-view, order-select, order-sign). We also request sandbox
and test-harness access to validate conformance before any customer go-live.

---

## 4. Does your product use Robotic Process Automation (RPA)? (limit 1,000 chars)

No. CareOS does not use Robotic Process Automation. It integrates exclusively
through supported, standards-based APIs — SMART on FHIR (OAuth 2.0 / PKCE), FHIR
R4 (USCDI / US Core), SMART Backend Services, FHIR Bulk Data, HL7 v2 messaging,
and CDS Hooks. CareOS performs no UI-based RPA, no screen-scraping, no ingestion
from screen-reader software, and no keyboard or mouse emulation. Data is read and
written only via authenticated API calls with explicit OAuth scopes, and every
access is recorded in a tamper-evident audit log.

---

## 5. Enrollment Criteria — CareOS compliance notes

These are attestations the company makes. Notes below show how CareOS supports
each; **[CONFIRM]** items are factual and must be verified by the company.

- Complies with all applicable laws/regulations/privacy protections — Supported:
  HIPAA-aligned design; encryption at rest (AES-256-GCM) and audit controls
  (§164.312); see `docs/security/SECURITY_POLICY.md` and `COMPLIANCE_MATRIX.md`.
- Not on any US government sanctions list — [CONFIRM] company attestation.
- No inaccurate/deceptive statements about Epic or third parties — Attest true.
- No violation/interference with Epic agreements or programs — Attest true.
- No unauthorized access/use of Epic confidential information — Attest true; CareOS
  was built to public Epic on FHIR specs and open standards only.
- No infringement of IP rights — Attest true; original codebase, standards-based.
- Confidentiality agreements with employees/subcontractors — [CONFIRM] ensure
  signed NDAs/CIIAs are in place.
- Reasonable measures to protect confidential information; unique user IDs and
  need-to-know access — Supported: per-user clinician identities (NPI-scoped
  accounts, hashed credentials), least-privilege OAuth scopes, and a hash-chained
  PHI access audit log. [CONFIRM] internal access policy documented.
- Incorporated in the US or a country with strong IP/privacy/security protections * —
  Yes. Business Intuitive Inc. is incorporated in Washington State, USA.
- Primary place of business and Vendor-Services-accessing staff located in the US
  or comparable country * — Yes. Primary place of business: 720 Seneca St,
  Seattle, WA 98101, USA; staff located in the USA.
- No practices harming individual safety/security/privacy or entity security —
  Supported: deterministic clinical path (no LLM in decisions), audited access.
- Products conform to recognized industry standards for safety/security/privacy —
  Supported: SMART on FHIR, FHIR R4 / US Core, CDS Hooks, HL7 v2, OAuth 2.0/PKCE.
- Appropriate policies for identifying/responding to/informing customers of
  safety issues, security vulnerabilities, or privacy breaches — Yes. See
  `docs/security/VULNERABILITY_DISCLOSURE.md` (coordinated disclosure, CVSS
  triage SLAs, HIPAA Breach Notification Rule 60-day process) +
  `SECURITY_POLICY.md`. [CONFIRM] security@launchflow.tech is a monitored inbox.
- Offers a market-ready healthcare product (or well-defined plan) conforming to
  Epic's community standards, and can complete an Epic interface within 12 months —
  Supported: working product with live SMART/FHIR/CDS Hooks implementation; a
  12-month Epic interface timeline is realistic.
