# CareOS — Project Abstract

**Title:** CareOS

**Category:** Academic / Industry / Student *(pick one)*

**Letter of Support:** *attached if student submission*

---

## Project abstract (1,000 characters)

> A typical 4,000-visit outpatient clinic faces ~30,000 administrative
> actions per year: 16,000 intake documents, 8,400 lab order/result/chart
> cycles, and 5,600 Rx send/fill cycles. Staff capacity falls short by
> ~5,280 hours, pushing 11,440 hours of overflow onto clinicians — a primary
> driver of burnout. CareOS is a HIPAA-compliant clinical operations
> platform that absorbs this load via three layers: (1) a universal EHR
> relay (HL7 v2 MLLP, FHIR R4, Epic/Cerner/VA Backend Services) ingesting
> messages into one canonical patient record; (2) a hash-chained
> tamper-evident audit log plus AES-256-GCM envelope encryption satisfying
> HIPAA §164.312(b/e); (3) workflow agents automating intake summarization,
> lab-loop closure, and Rx fulfillment. A working relay is deployed at
> launchflow.tech with end-to-end HL7 → FHIR → Postgres ingestion and
> verified audit-chain integrity. Empirical evaluation will use time-motion
> studies, EHR-log analysis, and administrative-throughput metrics.

---

## Character count

The block above is **987 characters** (within the 1,000 limit).

If a stricter cap is imposed, further candidate cuts:
- Replace "HIPAA §164.312(b/e)" with "the HIPAA Security Rule" → +4 chars (no help)
- Drop "and verified audit-chain integrity" → -34 chars
- Replace "Epic/Cerner/VA Backend Services" with "Epic/Cerner/VA APIs" → -12 chars
- Drop "(b/e)" from the HIPAA citation → -5 chars

## Talking points (not in abstract; for follow-up questions)

- **Concrete burden math** (matches the vision doc):
  4,000 visits × 4 intake docs = 16,000;
  4,000 × 70% × 3 lab actions = 8,400;
  4,000 × 70% × 2 Rx actions = 5,600;
  total ≈ 30,000 actions/yr/clinic.

- **Why a relay, not just an API**:
  Hospitals still emit HL7 v2 over MLLP for ADT/ORU/SIU/MDM, even when
  they expose FHIR for read-only patient data. CareOS speaks both, plus
  Backend Services for batch pulls.

- **Why hash-chained audit**:
  HIPAA §164.312(b) requires "mechanisms to record and examine activity"
  on PHI; a hash chain makes silent log edits detectable, which a plain
  audit table does not.

- **Live deployment URL** (for reviewer verification):
  - `https://launchflow.tech/.well-known/jwks.json` (Backend Services keys)
  - `https://launchflow.tech/api/relay/status` (relay health)
  - `https://launchflow.tech/api/relay/audit/verify` (chain integrity proof)

- **Evaluation plan**:
  Phase 1 — synthetic patient-load simulation against deployed relay;
  Phase 2 — pilot at 1–2 clinics with paired time-motion + EHR-log studies;
  Phase 3 — multi-site randomized comparison vs. baseline workflow.

- **Patient Fishbowl™ (coined term)**:
  A read-only, patient-visible workflow-transparency model — patients observe the *status*,
  *progression*, and *coordination* of their care in near real time, without altering the canonical
  clinical record. It's the patient-facing complement to the clinician intake summary.

- **No LLM in the clinical path** (deterministic by design):
  The relay, HL7→FHIR transforms, workflow agents, audit chain, and the Patient Fishbowl are fully
  deterministic — rule-based and reproducible, which is what makes the audit chain meaningful and the
  behavior safe on PHI. The *only* generative-AI component is a separate, optional, patient-facing
  consent assistant (`ai-layer`) that explains access requests in plain language; it never writes the
  canonical record and is not in the decision/automation path.
