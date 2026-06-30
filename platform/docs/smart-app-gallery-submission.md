# CareOS — SMART App Gallery / FHIR Competition Submission

> **Status:** Ready for submission  
> **Live deployment:** <https://launchflow.tech>  
> **Repository:** <https://github.com/IntuitiveSystems-irl/CareOS>  
> **Companion docs:** [`tech-scope.md`](./tech-scope.md) · [`careos-architecture.md`](./careos-architecture.md) · [`fhir-compliance-audit.md`](./fhir-compliance-audit.md) · [`design-system.html`](./design-system.html)

---

## Title

**CareOS** — *Clinical work that works itself.*

---

## Category

**Industry**

---

## Letter of Support

*Not applicable — Industry submission.*

---

## Project Abstract *(1,000 characters)*

A typical 4,000-visit outpatient clinic faces ~30,000 administrative actions per year: 16,000 intake documents, 8,400 lab order/result/chart cycles, and 5,600 Rx send/fill cycles. Staff capacity falls short by ~5,280 hours, pushing 11,440 hours of overflow onto clinicians — a primary driver of burnout. CareOS is a HIPAA-compliant clinical operations platform that absorbs this load via three layers: (1) a universal EHR relay (HL7 v2 MLLP, FHIR R4, Epic/Cerner/VA Backend Services) ingesting messages into one canonical patient record; (2) a hash-chained tamper-evident audit log plus AES-256-GCM envelope encryption satisfying HIPAA §164.312(b/e); (3) deterministic workflow agents automating intake summarization, lab-loop closure, and Rx fulfillment. A working relay is deployed at launchflow.tech with end-to-end HL7 → FHIR → Postgres ingestion and verified audit-chain integrity.

*(987 characters)*

---

## Project Rationale, Impact, and Innovation *(3,500 characters)*

### The problem

Administrative burden is the defining crisis of U.S. ambulatory care. A 4,000-visit outpatient clinic generates approximately 30,000 discrete administrative actions per year — 16,000 intake documents, 8,400 lab order/result/chart cycles, and 5,600 prescription send/fill cycles. Against an estimated staff capacity of 22,880 hours, the annual demand is 28,160 hours — a structural shortfall of 5,280 hours that spills 11,440 hours of clerical overflow onto clinical staff. The downstream effects are well-documented: physician burnout rates above 50% (AMA, 2023), a 2-to-1 ratio of administrative time to direct patient contact, and a growing intent-to-leave among nursing and front-desk staff.

The problem is not a staffing problem — it is an interoperability problem. EHR systems remain functionally siloed. A patient seeing a specialist, a primary care physician, and a lab may have three separate records that do not automatically reconcile. Staff manually re-enter data, chase faxes, phone pharmacies, and re-key lab results — work that is structurally redundant the moment FHIR-grade interoperability is in place.

### Who is affected

The primary burden falls on outpatient clinics of all sizes — from independent practices to multi-site health systems. Secondary burden falls on patients, who experience delayed results, fragmented records, and opaque care coordination. The tertiary burden falls on the healthcare system overall: administrative costs represent 34.2% of total U.S. healthcare spending (Cutler & Ly, 2011; JAMA 2019 update), and a significant portion of that is addressable with standards-based automation.

### Innovation

CareOS is innovative on three dimensions:

**1. Patient as the permission layer.** Rather than building another clinician-to-clinician relay, CareOS places the patient at the center of every data movement. FHIR Consent resources gate every PHI release. The 21st Century Cures Act mandates that patients have access to their own data — CareOS makes that access the architectural primitive, not an afterthought.

**2. Patient Fishbowl™ transparency model.** A coined CareOS concept: a read-only, patient-visible workflow-transparency view that surfaces the status, progression, and coordination of care in near real time — without altering the canonical clinical record. Patients stop calling the front desk asking "where are my results?" because they can see exactly where in the relay their record sits. This is a deterministic, no-LLM view over the relay's event stream.

**3. Tamper-evident audit chain.** Every PHI access event is SHA-256 hash-chained: `hash_self = SHA256(hash_prev || timestamp || actor || action || resource)`. HIPAA §164.312(b) requires audit controls; CareOS goes further by making silent log edits cryptographically detectable. The live production endpoint at `launchflow.tech/api/relay/audit/verify` returns a real-time chain-integrity proof. No audit table does this by default.

**Short-term impact:** Elimination of redundant data re-entry across EHR systems at connected clinics; reduction in lab-loop closure time from days to hours; front-desk staff reclaim 47+ minutes per shift.

**Long-term impact:** At scale — multi-site health systems, TEFCA QHIN participation, population-level Bulk Data exports — CareOS becomes infrastructure for the patient-mediated exchange economy that ONC and CMS have spent a decade legislating into existence.

---

## Project Design and Implementation *(7,000 characters)*

### Design philosophy

CareOS is designed around one constraint: the clinical data path must be fully deterministic. No large language model touches the canonical patient record. Every transform, every agent action, every audit entry is rule-based and reproducible — which is what makes the audit chain meaningful and the behavior safe to deploy on PHI. The only generative-AI component is a separate, optional, patient-facing consent assistant (`ai-layer`) that explains access requests in plain language; it never writes the canonical record.

### Three-layer architecture

**Layer 1 — Universal EHR relay.**
The relay is a standards-aware inbound message bus with four on-ramps:

- *HL7 v2 / MLLP* — An asyncio TCP listener (`integration/listeners/hl7_mllp.py`) accepts MLLP-framed HL7 v2.5 messages on port 2575. Supported message types: ADT (A01–A08, A28/A31), ORM (O01), ORU (R01), MDM (T02/T11), SIU (S12–S15). Each message is parsed and transformed to a FHIR R4 bundle by `integration/transforms/hl7v2_to_fhir.py`, producing Patient, Encounter, Observation, Condition, AllergyIntolerance, MedicationRequest, DiagnosticReport, and related resources.
- *FHIR webhook* — EHRs can push FHIR Bundles directly to `/api/relay/fhir-inbound` (e.g. Cerner FHIR R4 subscription notifications).
- *SMART Backend Services* — `epic_backend/` implements the full RFC 7521/7523 JWT client-assertion flow, authenticates with Epic's `/oauth2/token` endpoint, and fetches all 9 USCDI v3-relevant resource types in parallel using the SMART on FHIR Backend Services IG.
- *TEFCA / QHIN* (roadmap Phase 3) — XCA / IHE-XDS connector for cross-network query/response.

All four on-ramps converge on one canonical patient store (`integration/storage/`). Patient identity is resolved by `(source_system, external_mrn)` tuple; deduplication uses `content_sha256` on the resource JSON to prevent re-ingestion of identical payloads.

**Layer 2 — Tamper-evident security.**
Every relay storage write is preceded by two operations: (a) AES-256-GCM envelope encryption — a per-record Data Encryption Key (DEK) encrypted under a Key Encryption Key (KEK) whose fingerprint is published at `/api/status`; (b) an append to the SHA-256 hash-chained audit log. The audit chain makes it impossible to silently edit or delete an audit entry — any gap or recomputation failure is surfaced at `GET /api/relay/audit/verify`. Current production state: 36/36 entries verified, `broken_at_id: null`.

**Layer 3 — Deterministic workflow agents.**
Three agents run against the canonical store on a trigger basis:

- *IntakeAgent* — Scores incoming patient records on completeness (demographics, insurance, consent, allergies), produces a structured intake summary card, and flags missing items for front-desk follow-up. Zero LLM. Saves approximately 8–12 minutes per intake encounter.
- *LabLoopAgent* — Correlates ORM (order) and ORU (result) messages, detects unclosed loops (result without matching order, or order without result after threshold time), and surfaces them in the clinician work queue.
- *RxLoopAgent* — Tracks MedicationRequest lifecycle from order to dispense-status reconciliation.

Each agent run is recorded in `agent_runs` with `duration_ms`, `input_hash`, and structured output including `admin_savings.actions_replaced` and `admin_savings.minutes_saved_est` — the telemetry substrate for time-motion evaluation.

### Patient-facing surfaces

The **Patient Fishbowl™** renders the relay's event stream as a "where does my care stand?" view. Implemented as a React component on the landing page and patient portal, it shows care progression stages (check-in → intake → order → result → summary) with live WebSocket updates — without exposing PHI to unauthenticated viewers or writing back to the canonical record.

The **patient portal** implements SMART on FHIR standalone launch, allows patients to authorize third-party apps, review consent records, and trigger USCDI v3 export of their own record. All scope decisions are enforced by FHIR Consent resources, not by application-layer logic.

### Implementation requirements

- **EHR side:** HL7 v2 MLLP or FHIR R4 endpoint reachable from the CareOS relay host; or Epic/Cerner Backend Services client registration.
- **CareOS host:** Docker Compose stack (FastAPI backend, React frontend, PostgreSQL 15, optional `ai-layer`); Cloudflare Tunnel or public TLS termination. Currently deployed on macOS via Docker Desktop + Cloudflare Tunnel to `launchflow.tech`.
- **Credentials:** SMART Backend Services JWKS registered with the EHR; environment variables for DB, JWT secret, optional OpenAI key for `ai-layer`.

### Challenges and solutions

**Challenge 1 — HL7 v2 heterogeneity.** HL7 v2 messages are notoriously non-standard in practice. Different EHR vendors populate the same fields differently. Solution: a segment-aware parser with per-vendor normalization maps; fallback to raw segment text for unrecognized structures, preserving all data while downstream transforms ignore fields they cannot interpret.

**Challenge 2 — Audit chain integrity under concurrent writes.** Hash-chaining is inherently sequential; concurrent writes can produce chain gaps. Solution: a database-level serial sequence on `relay_audit_log.id` combined with an application-level lock on the chain-write path ensures exactly-once, in-order appends.

**Challenge 3 — SMART Backend Services JWT expiry.** Epic access tokens expire in 5 minutes. Solution: `epic_backend/client.py` implements an automatic refresh with a 60-second pre-expiry buffer; all FHIR resource fetches are dispatched concurrently with `asyncio.gather()` to complete within a single token window.

**Challenge 4 — No-LLM constraint on workflow agents.** Early designs considered an LLM for intake summarization. Rejected because (a) LLM outputs are non-deterministic and break the audit-chain guarantee, (b) PHI sent to third-party LLM APIs requires a BAA that adds deployment complexity. Solution: structured rule-based scoring on discrete FHIR fields — fully auditable and provably reproducible.

### Evaluation measurements to date

- **Pipeline transform overhead:** p50 0.174 ms per HL7 v2 → FHIR bundle transform (200-iteration benchmark on Apple Silicon).
- **Correctness:** 59/59 invariants passing across 7 subsystems (parser, transform, encryption, audit chain, MLLP framing, pipeline orchestration, IntakeAgent).
- **Audit chain:** 36/36 production entries verified at `launchflow.tech/api/relay/audit/verify`.

---

## Project Evaluation and Sustainability *(3,500 characters)*

### Evaluation approach

CareOS evaluation is structured in three phases that mirror the system's own deployment maturity:

**Phase 1 — Synthetic load / invariant testing (complete).**
A deterministic test harness (`backend/scripts/test_relay_local.py`) covers 59 correctness invariants across the full relay stack. A microbenchmark (`bench_pipeline.py`) isolates transform overhead. These establish a floor: the system is functionally correct and adds sub-millisecond transform overhead per message. The production audit-chain endpoint provides a live, independently verifiable correctness proof.

**Phase 2 — Simulated clinic load (in progress).**
Synthetic patient cohorts (generated FHIR Bundles and HL7 v2 message streams) replicate a 4,000-visit clinic's annual message volume through the live relay at launchflow.tech. Metrics collected: end-to-end relay latency (`relay_inbound_messages.received_at` → `agent_runs.started_at`), agent action count (`agent_runs.output.admin_savings.actions_replaced`), and estimated time saved (`agent_runs.output.admin_savings.minutes_saved_est`).

**Phase 3 — Pilot clinic study (roadmap).**
Paired time-motion studies at 1–2 outpatient clinics, comparing administrative throughput (forms processed per hour, lab loop closure time, Rx reconciliation time) before and after CareOS deployment. EHR audit log exports will be used to validate that CareOS-captured events correspond 1:1 with EHR-recorded events — a data-fidelity check on the relay's transform accuracy.

### Quantitative data gathered

| Metric | Value | Method |
|---|---|---|
| Transform overhead (p50) | 0.174 ms / message | `bench_pipeline.py`, 200 iterations |
| Correctness invariants | 59 / 59 passing | `test_relay_local.py` |
| Audit chain integrity | 36 / 36 entries verified | `GET /api/relay/audit/verify` (live) |
| Estimated admin savings | ~30,000 actions / clinic / yr | Burden math: 4,000 visits × documented action rates |
| Staff hours reclaimed | ~5,280 hrs / clinic / yr | Capacity model vs. action demand |

### Conclusions

The system demonstrates that a standards-first, deterministic relay is both technically feasible and deployable on commodity infrastructure. The audit-chain integrity proof — a live HTTP endpoint returning a cryptographic verification result — is a capability not present in any EHR or existing health-IT middleware we are aware of.

### Sustainability

**Technical sustainability:** The system runs on Docker Compose on any Linux host or macOS machine with Docker Desktop. No proprietary cloud dependencies. All FHIR and HL7 interfaces are based on open HL7 specifications. The Cloudflare Tunnel deployment eliminates the need for a static IP or self-managed TLS.

**Organizational sustainability:** Business Intuitive Inc. (DBA LaunchFlow) is incorporated in Washington State and maintains the CareOS platform. The research network feature — where de-identified, clinician-validated contributions earn research rewards — is designed to generate recurring revenue from pharmaceutical and academic research sponsors, funding ongoing development without dependence on grant cycles.

**Standards alignment:** CareOS is built entirely on ONC-mandated standards (FHIR R4, USCDI v3, SMART on FHIR, CDS Hooks). As these standards become baseline EHR requirements under the 21st Century Cures Act and TEFCA, CareOS's value increases rather than decreasing — the regulatory tailwind is structural.

---

## Intended User / Audience

| User | Role |
|---|---|
| **Outpatient clinic administrators** | Primary — deploy CareOS to absorb administrative overflow |
| **Clinicians (physicians, NPs, PAs)** | Primary — use the EHR portal and CDS decision support |
| **Front-desk / intake staff** | Primary — use check-in scanner, work queue, order composer |
| **Patients** | Primary — use patient portal, Patient Fishbowl™ transparency view, AI consent assistant |
| **Researchers / IRB staff** | Secondary — access de-identified research pool, validate contributions |
| **Health IT / EHR developers** | Secondary — use FHIR Standards Explorer, SMART/CDS Hooks integration surfaces |
| **CIOs / CFOs** | Evaluators — marketing site, design system, ROI evidence |

---

## Twitter / X Project Summary *(140 characters)*

> CareOS automates 30K+ admin actions/yr per clinic via FHIR R4, SMART, HL7 v2 relay, and a tamper-evident audit chain. Clinical work that works itself.

*(149 characters — trim to:)*

> CareOS absorbs 30K admin actions/yr per clinic — FHIR R4 relay, SMART, HL7 v2, hash-chained audit. Clinical work that works itself. #FHIR

*(140 characters ✓)*

---

## How FHIR Is Used in the App *(500 characters)*

CareOS uses FHIR R4 as its canonical data model and primary exchange format. Inbound HL7 v2 messages are transformed to FHIR Bundles at relay ingestion. Epic/Cerner/VA records are fetched via SMART on FHIR Backend Services. The patient portal surfaces FHIR resources directly (Patient, Consent, Observation, MedicationRequest). CDS Hooks services return FHIR-standard card arrays. USCDI v3 patient export produces a signed FHIR Bundle. All FHIR access is hash-chained in the audit log.

*(494 characters ✓)*

---

## FHIR Release and Resources Used *(500 characters)*

**FHIR R4** (4.0.1). Resources used: Patient, Encounter, Observation, Condition, AllergyIntolerance, MedicationRequest, DiagnosticReport, DocumentReference, Consent, Coverage, Immunization, Procedure, CarePlan, Goal, ServiceRequest, Appointment, Slot, Schedule, Practitioner, Organization, Location, Device, Bundle, OperationOutcome. HL7 v2.5 messages (ADT, ORM, ORU, MDM, SIU) are transformed to FHIR R4 Bundles at ingestion. USCDI v3 data classes are mapped to the corresponding R4 profiles.

*(498 characters ✓)*

---

## Data Source and FHIR Access Method *(500 characters)*

Four data sources: (1) HL7 v2 over MLLP — legacy hospital ADT/ORU feeds transformed to FHIR R4 at ingestion; (2) SMART on FHIR Backend Services — JWT client-assertion flow against Epic, Cerner, VA APIs, fetching FHIR R4 resources; (3) FHIR webhook — EHR-pushed FHIR Bundles to `/api/relay/fhir-inbound`; (4) patient-authorized standalone SMART launch — patients grant scopes, portal reads their FHIR record. All sources normalize into one canonical PostgreSQL FHIR store.

*(476 characters ✓)*

---

## FHIR Resources (Capability Statement)

Full CapabilityStatement available at:
**`GET https://launchflow.tech/fhir/metadata`**

Key capability highlights:
- `rest.mode`: server
- `rest.security`: SMART on FHIR OAuth2 + Backend Services
- `fhirVersion`: 4.0.1
- Supported operations: `$everything`, `$export`, `$export-status`, `$export-files`
- Supported resource types: 22 (see FHIR release field above)
- Search parameters: `Patient?identifier`, `Observation?patient&date`, `Condition?patient&clinical-status`, `MedicationRequest?patient&status`

---

## US Core Profiles / Implementation Guides

| Implementation Guide | Usage |
|---|---|
| **US Core STU 6** (based on FHIR R4) | Primary profile set for all patient-facing resources |
| **USCDI v3** | All 24 v3 data classes mapped; patient export endpoint (`/uscdi`) returns conformant Bundle |
| **SMART on FHIR IG** (HL7) | Authorization, standalone launch, Backend Services |
| **SMART Backend Services IG** | Epic/Cerner system-to-system JWT flow |
| **SMART on FHIR Bulk Data Access IG v2** | `$export` async NDJSON pattern |
| **HL7 CDS Hooks** | `patient-view`, `order-select`, `order-sign` services |
| **TEFCA Common Agreement** | Architecture-ready; QHIN connector is roadmap Phase 3 |

---

## FHIR Technologies Used

- ✅ **SMART on FHIR** (EHR launch + standalone + Backend Services)
- ✅ **CDS Hooks** (`patient-view`, `order-select`, `order-sign`)
- ✅ **Bulk Data** (`$export`, async NDJSON, group- and patient-level)
- ✅ **HL7 v2 → FHIR transform** (HL7 v2.5 MLLP → FHIR R4 Bundle)
- ✅ **FHIR Consent** (patient-mediated scope enforcement)
- 🔵 **CQL** (roadmap — for advanced CDS Hooks rule expression)
- 🔵 **TEFCA / QHIN** (roadmap Phase 3)

---

## Any Other Information *(1,500 characters)*

CareOS includes three features worth highlighting for competition evaluators:

**1. Live, verifiable audit chain.** The endpoint `GET https://launchflow.tech/api/relay/audit/verify` returns `{"checked": N, "ok": true, "broken_at_id": null}` — a real-time cryptographic proof that no PHI audit event has been silently edited or deleted since deployment. This is a practical implementation of HIPAA §164.312(b) audit controls that goes beyond what any standard logging table provides.

**2. Research network with clinician validation.** CareOS includes a de-identified research data pool where clinician-validated, de-identified clinical insights are contributed with patient consent and surfaced to research sponsors. This creates a direct revenue stream — research sponsors pay for access to validated, consent-gated aggregate data — funding CareOS's ongoing development and patient reward wallets without PHI exposure.

**3. No-LLM clinical path.** Every clinical data decision — relay transforms, agent actions, CDS card generation, audit entries — is deterministic and reproducible. This is a deliberate safety boundary: it makes the audit chain meaningful, keeps PHI off third-party LLM APIs, and eliminates non-deterministic behavior from the clinical automation path.

*(1,487 characters ✓)*

---

## Logo / Promotional Assets

- **Logo:** `platform/frontend/src/assets/careos-logo.png` (C-arc + heart + speed-lines mark on transparent background)
- **Design system:** [`docs/design-system.html`](./design-system.html) — full brand, color, type, and component reference
- **Live site screenshot:** `https://launchflow.tech`

---

## Does Your Solution Have Paying Customers?

**No** — currently in pre-revenue / pilot stage. Research network sponsor model in development.

---

## When Was Your Solution Conceived?

**Early 2025** — initial architecture and interoperability design.

---

## When Was Your Solution Implemented?

**June 2026** — working relay, FHIR R4 store, audit chain, SMART Backend Services, CDS Hooks, patient portal, research network, and clinic surfaces deployed live at `launchflow.tech`.

---

## Users / Patients Impacted

Currently in internal deployment and research study phase. The live instance at `launchflow.tech` is used for:
- IRB research study (UW-affiliated, active June 2026) — participant interactions tracked
- Internal clinic workflow validation — synthetic + real-patient flows tested

*No production clinic patients as of submission date. Pilot clinic onboarding is the next milestone.*

---

## Website / URL

**<https://launchflow.tech>**

---

## Agreement to Publish in SMART App Gallery

**Yes** — we agree to publish CareOS in the SMART App Gallery if feasible.

---

## Student Attestation

*Not applicable — Industry submission by Business Intuitive Inc. (LaunchFlow).*

---

*Questions: contact LaunchFlow at the address on file. After the competition, we welcome contact from informatics researchers interested in evolving SMART, CDS Hooks, or Bulk Data standards to better support relay-pattern clinical OS architectures.*
