# CareOS — SMART App Gallery / FHIR Competition Application

> **Working draft.** Items marked **[TODO]** need a real value from you (dates, names,
> photo/video links, etc.) before submission. Character counts are noted for bounded fields.
>
> Companion docs in this repo: [`careos-abstract.md`](./careos-abstract.md) (1,000-char abstract),
> [`careos-architecture.md`](./careos-architecture.md) (full technical architecture), and
> [`security/SECURITY_POLICY.md`](./security/SECURITY_POLICY.md) /
> [`security/COMPLIANCE_MATRIX.md`](./security/COMPLIANCE_MATRIX.md).

---

## 1. Title, team, and category

- **Project title:** CareOS
- **Tagline:** *Clinical work that works itself.*
- **Team / organization:** LaunchFlow — [TODO: members + roles]
- **Category:** Academic / Industry / Student — [TODO: pick one]
- **Primary contact:** [TODO: name · email]
- **Live deployment:** <https://launchflow.tech>
- **Letter of support:** [TODO: attach if student submission]

---

## 2. Elevator pitch (≤ 280 characters)

> CareOS is a HIPAA-grade clinical operations platform: a universal EHR relay (HL7 v2, FHIR R4,
> SMART Backend Services) feeds one canonical patient record, a hash-chained audit makes every PHI
> event tamper-evident, and deterministic workflow agents absorb administrative overflow.

*(≈ 277 characters — [TODO] confirm against the form's exact limit.)*

---

## 3. Project abstract (1,000 characters)

The full 987-character abstract lives in [`careos-abstract.md`](./careos-abstract.md). Summary:

> A typical 4,000-visit outpatient clinic faces ~30,000 administrative actions per year. Staff
> capacity falls short by ~5,280 hours, pushing 11,440 hours of overflow onto clinicians — a primary
> driver of burnout. CareOS absorbs this load via (1) a universal EHR relay, (2) a hash-chained
> tamper-evident audit log plus AES-256-GCM envelope encryption, and (3) workflow agents. A working
> relay is deployed at launchflow.tech with end-to-end HL7 → FHIR → Postgres ingestion and verified
> audit-chain integrity.

---

## 4. The problem

A four-thousand-visit outpatient clinic produces roughly **thirty thousand administrative actions a
year** — patient intake forms, lab order/result/chart loop closure, prescription send/fill
reconciliation, prior-authorization paperwork, and care-team coordination. Full-time admins cover
roughly 4,160 hours; the remaining **~11,440 hours of work falls to clinicians as overflow**, and is
the single most-cited driver of clinician burnout in the literature. Existing point solutions either
chase one workflow at a time or assume the clinic has already standardized on a single EHR. Most
clinics have not.

---

## 5. Who it's for

- **Clinicians** — get administrative overflow absorbed and a clinician-ready intake summary instead
  of raw inbox noise.
- **Clinic administrative staff** — fewer manual re-keying loops across labs, pharmacies, referrals.
- **Patients** — a read-only **Patient Fishbowl™** view of where their care actually stands, plus
  Cures-Act-compliant portability of their own record.
- **Health-IT / interoperability teams** — a standards-native relay that speaks HL7 v2, FHIR R4, and
  SMART Backend Services without a per-EHR rewrite.

---

## 6. Project design and implementation (7,000 char limit)

> *How did your design address the problem? How did you implement your solution and what
> requirements must be met to be able to do so? What challenges did you have to overcome?*

**The problem.** A four-thousand-visit outpatient clinic produces roughly thirty thousand
administrative actions a year — intake forms, lab order/result/chart loop closure, prescription
send/fill reconciliation, prior-authorization paperwork, and care-team coordination. Full-time
admins cover ~4,160 hours; the remaining ~11,440 hours fall to clinicians as overflow, the most-cited
driver of burnout. Point solutions chase one workflow at a time or assume a single standardized EHR.

**The design.** CareOS is a HIPAA-grade clinical operations platform organized as **three layered
services that share one canonical FHIR R4 patient store**, plus a patient-facing transparency layer.

1. **Universal EHR relay.** Three concurrent ingress paths land on one schema: an **HL7 v2.5 MLLP
   listener on port 2575** for legacy interface engines; a **FHIR R4 webhook receiver** for
   push-style EHRs; and an **outbound SMART on FHIR Backend Services** grant (RFC 7521/7523 JWT
   client-assertion) for systems like Epic on FHIR. A unified transform layer normalizes HL7 v2
   segments to FHIR R4 resources (Patient, Encounter, Observation, AllergyIntolerance, Condition,
   MedicationRequest, MedicationStatement, Immunization, Procedure, DiagnosticReport, ImagingStudy,
   DocumentReference, CareTeam, Goal, Provenance, Device) so everything downstream sees the same
   shape no matter which EHR emitted it.

2. **Tamper-evident audit + envelope encryption.** Every PHI access — inbound message, transform,
   write, read, agent invocation, bulk export — emits a row to a **hash-chained audit log** keyed by
   `SHA-256(prev_hash || payload)`. Silent edits are detectable in O(n) verification time, satisfying
   the spirit of **HIPAA §164.312(b)**. Payloads are envelope-encrypted at rest with **AES-256-GCM**
   (per-record DEK wrapped by a KEK), aligned with **§164.312(a)(2)(iv)**.

3. **Deterministic workflow agents.** Agents react to canonical events and replace manual admin
   steps. **IntakeAgent** (live) turns an ADT admit/registration into a clinician-ready intake
   summary — demographics, problems, allergies, meds, recent observations — and flags missing
   required fields, while recording admin-action savings for time-motion evaluation. **LabLoopAgent**
   and **RxLoopAgent** are on the roadmap.

**Patient Fishbowl™ (coined term).** A **patient-visible workflow-transparency model**: patients can
observe the **status**, **progression**, and **coordination** of their care processes in near real
time **without altering the canonical clinical record** (read-only by construction). It turns the
relay's event stream into a plain-language "where does my care stand?" view — the patient-facing
complement to the clinician's intake summary.

**Design philosophy — deterministic, no LLM in the clinical path.** The entire clinical data
path — EHR relay, HL7→FHIR transforms, the workflow agents, the audit chain, and the Patient
Fishbowl — is **fully deterministic and uses no large language model**. Every output is rule-based
and reproducible, which is exactly what makes the audit chain meaningful and the behavior safe to
deploy on PHI. The **only** generative-AI component is a *separate, optional, patient-facing consent
assistant* (the `ai-layer` service) that explains access requests and summarizes data in plain
language for patients; it **never writes the canonical clinical record** and is not in the
decision/automation path. This separation is a deliberate safety boundary, not an afterthought.

**Requirements to run it.** Docker Compose stack (Postgres, data-model migrations, FastAPI backend,
optional ai-layer, React/nginx frontend); a KEK for envelope encryption; TLS via Let's Encrypt; and,
for outbound Backend Services, a registered JWKS (published at `/.well-known/jwks.json`).

**Challenges overcome.** (a) *One schema from many wire formats* — HL7 v2 segment quirks vs. FHIR R4
resource shapes required a normalizing transform with a rule-based content router. (b) *Canonical
identity* — reconciling the same patient across sources by external MRN + source. (c)
*Tamper-evidence without trusting the DB* — a hash chain whose verification (`verify_chain()`)
recomputes every row and reports the first break. (d) *Proving overhead is real* — an isolated
pipeline microbenchmark separate from production end-to-end latency (see §10).

*(≈ [TODO] / 7,000 characters — trim if over.)*

---

## 7. Standards alignment & interoperability

| Capability | Standard / framework | Status |
|---|---|---|
| HL7 v2.5 MLLP ingest (:2575) | HL7 v2.x messaging | ✅ Live |
| HL7 → FHIR R4 transform | FHIR R4 resource mapping | ✅ Live |
| Outbound SMART Backend Services | SMART on FHIR Backend Services IG; RFC 7521/7523 | ✅ Live |
| FHIR R4 webhook receiver (inbound) | FHIR R4 push | ✅ Live |
| Tamper-evident audit | HIPAA §164.312(b) | ✅ Live |
| Envelope encryption at rest | HIPAA §164.312(a)(2)(iv); AES-256-GCM | ✅ Live |
| Patient Fishbowl™ transparency | CareOS-native (read-only view) | ✅ Live |
| FHIR Bulk Data `$export` | SMART Bulk Data Access IG v2 (NDJSON) | 🔨 Roadmap |
| USCDI v3 patient export | ONC USCDI v3 | 🔨 Roadmap |
| TEFCA / QHIN connector | TEFCA Common Agreement; XCA / IHE-XDS | 🔨 Roadmap |
| **CDS Hooks service (outbound to EHR)** | **HL7 CDS Hooks** | **✅ Implemented — see §11** |

---

## 8. Security, privacy & HIPAA compliance

- **Audit (§164.312(b)):** hash-chained log; integrity provable at
  `/api/relay/audit/verify`.
- **Encryption at rest (§164.312(a)(2)(iv)):** AES-256-GCM envelope encryption (per-record DEK + KEK).
- **Transport:** TLS 1.2/1.3, HSTS, hardened headers; DB/API loopback-bound, only nginx public.
- **Minimization:** agent outputs are PHI-safe summary cards (counts, presence flags, references),
  not raw PHI.
- **Safety by determinism:** no LLM in the clinical path (see §6) → reproducible, auditable behavior.
- Full write-ups: [`security/SECURITY_POLICY.md`](./security/SECURITY_POLICY.md),
  [`security/COMPLIANCE_MATRIX.md`](./security/COMPLIANCE_MATRIX.md).

---

## 9. Implementation status — live vs. roadmap

- **Live (deployed at launchflow.tech):** HL7 MLLP listener, HL7→FHIR transform, canonical store,
  hash-chained audit + integrity endpoint, AES-256-GCM envelope encryption, SMART Backend Services
  JWT flow + JWKS, IntakeAgent, Patient Fishbowl, the CareOS marketing/landing surface.
- **Roadmap:** FHIR Bulk Data `$export`, USCDI v3 single-call export, S3-compatible cloud archive,
  TEFCA/QHIN connector, LabLoopAgent, RxLoopAgent.
- **Implemented (Phase 4):** CDS Hooks service (`routers/cds_hooks.py`) — see §11.

See [`careos-architecture.md`](./careos-architecture.md) for the authoritative component table.

---

## 10. Evaluation, telemetry & evidence

- **Pipeline transform overhead:** median **0.174 ms** per message (HL7 v2 parse → FHIR Bundle →
  in-memory hand-off; 200 iters, Apple Silicon). This is framework overhead, *not* production
  end-to-end latency.
- **Correctness smoke test:** 59 / 59 invariants passing across 7 subsystems (parser, transform,
  encryption round-trip + tamper detection, audit-chain determinism, MLLP framing/ACK, pipeline,
  IntakeAgent).
- **Audit-chain integrity:** live endpoint reports `{"checked": N, "ok": true, "broken_at_id": null}`.
- **Burden math telemetry:** `agent_runs` capture `actions_replaced` / `minutes_saved_est` for
  time-motion analysis.
- **Reviewer-verifiable endpoints:** `/.well-known/jwks.json`, `/api/relay/status`,
  `/api/relay/audit/verify`, `/api/careos/burden`.

*(Numbers reflect the current deployment; re-run before submission and update — [TODO].)*

---

## 11. CDS Hooks — implemented & live

**What it is.** [CDS Hooks](https://cds-hooks.org/) is the HL7 standard for *surfacing decision
support inside the EHR's own workflow*. The EHR is configured with a CDS service URL; it discovers
services via `GET /cds-services` and, at defined moments — `patient-view` (opening a chart),
`order-select` / `order-sign` (placing orders) — calls `POST /cds-services/{id}` with the workflow
context plus optional FHIR **prefetch**. The service responds with **cards**: information, warnings,
or suggestions (and optional SMART app launch links) rendered to the clinician in-context.

**Why it's a natural fit for CareOS.** CareOS already holds a **canonical FHIR R4 patient store**, a
**deterministic rule-based content router**, and a **tamper-evident audit chain**. A CDS Hooks
service reuses all three: cards are generated by **deterministic clinical rules** (e.g.
drug–allergy and drug–drug interaction, overdue screening/recall, abnormal-result follow-up, care-gap
closure), every card request/response is **audited** like any other PHI event, and a card can deep-link
into the **Patient Fishbowl** or the clinician summary. Crucially, this keeps CareOS's safety
posture: **decision-support cards would be rule-derived and reproducible — no LLM in the loop.**

**Implementation.**
- FastAPI router `app/routers/cds_hooks.py` mounted at `/cds-services`.
- Prefetch populated from the canonical store; relational chart + patient feedback drive card selection.
- Card builders in `app/cds/cards.py` — pure functions, deterministic, no LLM.
- Every invocation audited via `integration/audit/recorder.py` (`phi_read` action).
- SMART launch links reuse the Backend Services / SMART scaffolding already present.

**Status: implemented.** CareOS's FHIR webhook is an **inbound receiver** (EHR → CareOS). CDS Hooks is the **outbound, in-workflow** direction (EHR → CareOS for guidance → cards back to the clinician). Both are live and complementary.

**Endpoints live at `/cds-services`:**
- `GET /cds-services` — discovery document
- `POST /cds-services/careos-patient-summary` — `patient-view` hook: relational safety cards + patient Fishbowl voice
- `POST /cds-services/careos-medication-safety` — `order-select` / `order-sign` hooks: allergy↔medication conflict alerts + patient preferences

---

## 12. Demo, deployment & reproducibility

- **Live:** <https://launchflow.tech> · clinician and patient entry points on the landing page.
- **Run locally:** `docker compose up --build` (see [`../README.md`](../README.md)); copy
  `.env.example` → `.env` first.
- **Demo video:** [TODO: link]
- **Source / commit for judging:** [TODO: repo URL + commit SHA]

---

## 13. Team, sustainability & licensing

- **Team & bios:** [TODO]
- **Sustainability / pilot plan:** phased pilot at 1–2 clinics with paired time-motion + EHR-log
  studies (see `careos-architecture.md` §6–7).
- **License:** [TODO]
