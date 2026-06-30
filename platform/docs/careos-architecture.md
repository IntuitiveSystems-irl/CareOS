# CareOS Architecture

> A HIPAA-compliant clinical operations platform that absorbs the
> ~30,000 administrative actions a 4,000-visit outpatient clinic generates
> each year — and that is built from the ground up to participate in the
> emerging cloud-based, patient-mediated medical-data-exchange ecosystem.

## 1. Why this architecture, why now

The U.S. health-IT landscape is being pushed in three converging directions
by federal rule-making and market pressure:

- **Patient-mediated portability.** The 21st Century Cures Act
  (and the ONC HTI-1 final rule) prohibit information blocking and
  require providers + EHRs to expose USCDI v3 to any patient-authorized
  application. CareOS is built as one of those authorized applications.

- **Standardized cloud exchange.** TEFCA (Trusted Exchange Framework and
  Common Agreement) defines QHINs (Qualified Health Information Networks)
  as the federally-sanctioned backbone for cross-organization clinical
  data exchange. CareOS is designed to participate as a QHIN-connected
  Health Information Network, not as a point-to-point integrator.

- **Bulk + asynchronous APIs.** SMART on FHIR Bulk Data Access
  (`$export` operation, NDJSON output, async pickup) is the de-facto
  standard for population-level transfer between cloud-native systems.

Every architectural choice in CareOS — the relay framework, the canonical
FHIR store, the agent layer, the audit chain, the cloud archive
transport — exists to *make those three patterns native, not bolt-on*.

## 2. Layered model

```
                        ┌────────────────────────────────────────────┐
                        │         CareOS Workflow Agents             │
                        │  IntakeAgent · LabLoopAgent · RxLoopAgent  │
                        └────────────────────────────────────────────┘
                                          ▲
                        ┌────────────────────────────────────────────┐
                        │          Canonical Patient Store           │
                        │  relay_inbound_messages · relay_fhir_…     │
                        │  envelope-encrypted (AES-256-GCM)          │
                        └────────────────────────────────────────────┘
                                          ▲
   ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
   │ HL7 MLLP   │  │ FHIR Webhook│  │ Backend Svcs │  │ TEFCA / QHIN     │
   │ (legacy    │  │ (push from  │  │ JWT bearer   │  │ exchange         │
   │  hospitals)│  │  EHR)       │  │ (Epic etc.)  │  │ (XCA, IHE, etc.) │
   └────────────┘  └─────────────┘  └──────────────┘  └──────────────────┘
                                          ▲
                                  ┌──────────────────┐
                                  │ Tamper-evident   │
                                  │ audit chain      │
                                  │ (HIPAA §164.312) │
                                  └──────────────────┘
```

### 2.1 Deterministic by design — no LLM in the clinical path

The entire clinical data path — EHR relay, HL7→FHIR transforms, the workflow agents, the audit
chain, and the **Patient Fishbowl™** — is **fully deterministic and uses no large language model**.
Outputs are rule-based and reproducible, which is exactly what makes the audit chain meaningful and
the behavior safe to run on PHI. The **only** generative-AI component is a *separate, optional,
patient-facing consent assistant* (the `ai-layer` service) that explains access requests and
summarizes data in plain language for patients; it **never writes the canonical clinical record** and
is not in the decision/automation path. This separation is a deliberate safety boundary.

### 2.2 Patient Fishbowl™ (patient-facing transparency)

A **read-only, patient-visible workflow-transparency model**: patients observe the **status**,
**progression**, and **coordination** of their care in near real time **without altering the
canonical record**. It is the patient-facing complement to the clinician intake summary, rendering
the relay's event stream as a plain-language “where does my care stand?” view (implemented on the
CareOS landing/marketing surface and patient views).

## 3. Component inventory and standards alignment

| CareOS component | Standard / framework it implements | Status |
|---|---|---|
| Backend Services JWT flow (`epic_backend/`) | SMART on FHIR Backend Services (HL7 IG); RFC 7521/7523 | ✅ Live |
| MLLP listener (`integration/listeners/hl7_mllp.py`) | HL7 v2.5 MLLP (port 2575); HL7 v2.x messaging | ✅ Live |
| HL7 → FHIR transform (`integration/transforms/hl7v2_to_fhir.py`) | FHIR R4 resource mapping (Patient, Encounter, Observation, AllergyIntolerance, Condition, MedicationRequest, …) | ✅ Live |
| Relay storage (`integration/storage/`) | FHIR R4 resource persistence; canonical patient identity by source + external MRN | ✅ Live |
| Audit chain (`integration/audit/`) | HIPAA §164.312(b) "Audit controls"; tamper-evidence via SHA-256 hash chain | ✅ Live |
| Envelope encryption (`integration/crypto/`) | HIPAA §164.312(a)(2)(iv) "Encryption at rest"; AES-256-GCM with per-record DEK + KEK | ✅ Live |
| Workflow agents (`integration/agents/`) | CareOS-native (no external standard); each run captured in `agent_runs` for time-motion eval | ✅ IntakeAgent live |
| Patient Fishbowl™ (patient transparency) | CareOS-native coined concept; read-only view over canonical events; **no LLM** | ✅ Live |
| Bulk Data `$export` | SMART on FHIR Bulk Data Access IG v2 (NDJSON, async polling, kick-off / status / output) | 🔨 Phase 2 |
| Cloud archive transport | S3-compatible blob storage; pluggable for AWS S3 / Cloudflare R2 / GCS / Wasabi | 🔨 Phase 2 |
| USCDI v3 export | ONC USCDI v3 data classes; `/api/careos/patients/{id}/uscdi` | 🔨 Phase 2 |
| TEFCA / QHIN connector | TEFCA Common Agreement; XCA / IHE-XDS for cross-network query | 🔨 Phase 3 |
| Patient consent + access management | SMART on FHIR scopes; HEART (HL7 / OAuth 2.0) for patient-mediated consent | ✅ Partial (in `patient_portal/`) |
| Information-blocking compliance hook | ONC HTI-1 §170.401 (information blocking exceptions) | 🔨 Phase 3 (audit-log + rejection-reason taxonomy) |
| CDS Hooks service (outbound to EHR) | HL7 CDS Hooks (`patient-view` / `order-select` / `order-sign`); deterministic rule-derived cards | ✅ Live (`routers/cds_hooks.py`) |

Legend: **✅ Live** = deployed at launchflow.tech; **🔨 Phase 2** = next slice; **🔨 Phase 3** = roadmap.

## 4. Cloud-interop subsystem (Phase 2)

### 4.1 FHIR Bulk Data `$export`

Three endpoints, exactly per the SMART on FHIR Bulk Data IG:

- `POST /api/careos/$export?_type=Patient,Observation,Condition…`
  Kicks off an export job. Returns `202 Accepted` with a polling URL.

- `GET /api/careos/$export-status/{job_id}`
  Returns 202 while running, 200 with NDJSON manifest when done.

- `GET /api/careos/$export-files/{file_id}`
  Streams the NDJSON file. Optionally redirects to a signed cloud URL.

NDJSON manifest example:
```json
{
  "transactionTime": "2026-05-26T18:00:00Z",
  "request":          "/api/careos/$export?_type=Patient,Observation",
  "requiresAccessToken": true,
  "output": [
    {"type": "Patient",     "url": "https://launchflow.tech/api/careos/$export-files/abc123-Patient.ndjson",     "count": 248},
    {"type": "Observation", "url": "https://launchflow.tech/api/careos/$export-files/abc123-Observation.ndjson", "count": 14721}
  ],
  "error": []
}
```

Each row in NDJSON is one FHIR resource — directly compatible with HAPI
FHIR, Microsoft Healthcare APIs, AWS HealthLake, Google Healthcare API,
and every TEFCA QHIN reference implementation.

### 4.2 Cloud archive transport

`integration/transports/cloud_archiver.py` is a `Transport` that:

1. Takes a pipeline message (FHIR Bundle) and serializes it to NDJSON.
2. Envelope-encrypts the NDJSON with the same KEK as the on-disk store.
3. Uploads to an S3-compatible endpoint via `boto3` (the S3 protocol is
   the lingua franca: AWS S3, Cloudflare R2, Google Cloud Storage's S3
   interop, Wasabi, Backblaze B2 — all wire-compatible).
4. Returns a signed (time-limited) URL that the patient or downstream
   QHIN can use to retrieve the encrypted blob.

Configuration via env: `CAREOS_CLOUD_ENDPOINT`, `CAREOS_CLOUD_BUCKET`,
`CAREOS_CLOUD_ACCESS_KEY`, `CAREOS_CLOUD_SECRET_KEY`,
`CAREOS_CLOUD_REGION`. No code change needed to switch providers.

### 4.3 USCDI v3 patient export

Single-call patient-mediated export at
`/api/careos/patients/{external_id}/uscdi?signed=1`.

Returns one FHIR Bundle covering all USCDI v3 data classes:

- Patient demographics
- Allergies & intolerances
- Care team members
- Clinical notes (DocumentReference)
- Diagnostic imaging
- Encounters
- Goals
- Health concerns
- Immunizations
- Laboratory (Observations)
- Medications
- Patient-reported outcomes
- Problems (Conditions)
- Procedures
- Provenance
- Smoking status
- Unique device identifiers
- Vital signs

When `signed=1`, returns `202` + a one-time pickup URL backed by the
cloud archiver — the format TEFCA QHINs and patient-app developers expect.

## 5. Identity, consent, and the information-blocking firewall

CareOS surfaces four authentication contexts, each with a distinct
audit-log `actor` namespace:

| Context | Actor namespace example | Use case |
|---|---|---|
| Service-to-service (Backend Services) | `backend.epic.<client_id>` | Bulk pulls, scheduled ingests |
| Authorized clinician | `clinician.<npi>` | Viewing summary cards, reviewing flagged items |
| Authorized patient | `patient.<external_id>` | Cures-Act-mandated patient access |
| QHIN-mediated peer | `qhin.<participant_id>` | TEFCA cross-network query/response |

Every PHI access is hash-chained — so an information-blocking complaint
or HIPAA audit can be answered with a cryptographic proof of *what* was
shared, *with whom*, and *under what authority*, without trusting the
mutability of the database.

## 6. Evaluation & telemetry plan

The abstract commits to "time-motion studies, EHR-log analysis, and
administrative-throughput metrics." The data substrate for that
evaluation is already in place:

- `agent_runs.duration_ms` per run → time-motion math
- `agent_runs.output.admin_savings.{actions_replaced,minutes_saved_est}`
  → throughput math
- `relay_audit_log` → clean-room reconstruction of every PHI event
- `relay_inbound_messages.received_at` vs. `agent_runs.started_at`
  → end-to-end latency from EHR emit to system action

Phase-1 evaluation artifacts will be SQL views on top of these tables
(no new schema needed).

### 6.1 Measurements to date

Two latency figures matter for this system, and they must not be
conflated:

**(a) Pipeline transform overhead** — the cost of the framework itself
on one message: HL7 v2 parse → FHIR Bundle assembly → in-memory
transport hand-off, in a single Python process with no DB, no socket,
no audit-chain `INSERT`, no agent run, no encryption. This isolates
*"what does CareOS add on top of an HL7 byte stream?"*

- **Harness:** `backend/scripts/bench_pipeline.py` (200 iterations,
  50 warmups, `time.perf_counter()`).
- **Path under test:** `PipelineMessage(raw HL7) → Hl7v2ToFhirTransform
  → CapturingTransport → return`, dispatched via `Pipeline.dispatch()`.
- **Payload:** 269-byte HL7 v2.5 ADT^A04 with `PID`, `PV1`, `DG1`,
  `OBX`, `AL1` segments (5 FHIR resources produced per message).
- **Host:** Apple Silicon (`macOS arm64`), CPython 3.9.6, single core.
- **Result:** min 0.155 ms · **p50 0.174 ms** · p95 0.232 ms ·
  p99 0.403 ms · mean 0.185 ms · σ 0.041 ms.

The "0.17 ms" figure cited in evaluation summaries is this median
value. It is *transform overhead*, not production end-to-end latency.

**(b) Production end-to-end latency** — `relay_inbound_messages.
received_at` vs. `agent_runs.started_at`, defined above. This is the
slower, more honest number that includes MLLP framing, envelope
encryption, audit-chain `INSERT`, scheduler wake-up, and agent
selection. It will be reported from production traces during the
Phase-6 pilot, not from the microbenchmark.

### 6.2 Correctness invariants under test

Two correctness checks are reported alongside the latency figure:

**Smoke test — 59 / 59 invariants passing.**
Framework correctness is exercised by an in-process smoke test
(`backend/scripts/test_relay_local.py`) covering 7 subsystems —
HL7 parser, HL7→FHIR transform, envelope encryption (round-trip +
tamper detection), audit-chain hash (determinism + sensitivity), MLLP
framing + ACK builder, pipeline orchestration, and `IntakeAgent`.
Each subsystem asserts a fixed set of invariants (e.g. *"ciphertext
tamper rejected"*, *"h2 sensitive to hash_prev"*, *"ACK echoes
original control_id"*); the current run reports 59 of 59 passing.
Counted by `grep -c "check(" backend/scripts/test_relay_local.py`
minus the function-definition / pass-through callsites — the runtime
total is the authoritative one and is printed by the script's own
summary line.

**Audit chain — 36 / 36 entries verified.**
Walked by `verify_chain()`
(`backend/app/integration/audit/recorder.py`), which iterates
`relay_audit_log` rows in id order and recomputes each row's
`hash_self = sha256(hash_prev || ts || actor || action || resource_*
|| message_id || content_sha256)`. Returns the first row id where the
chain breaks, or `null` if clean. The live production endpoint at
`https://launchflow.tech/api/relay/audit/verify` currently returns
`{"checked": 36, "ok": true, "broken_at_id": null}` — meaning all
36 PHI events recorded since deployment hash-chain back to the
genesis row with no silent edits.

## 7. Roadmap, in priority order

1. **Phase 2 (this sprint)** — Cloud interop subsystem (Bulk Data `$export`, cloud archiver, USCDI v3 patient export).
2. **Phase 2.5** — Marketing surface (CareOS landing page in the `Vibrant Wellness` / `CropTab` design language).
3. **Phase 3** — TEFCA / QHIN connector framework and information-blocking compliance hooks.
4. **Phase 4 (complete)** — **CDS Hooks service** — ✅ implemented in `routers/cds_hooks.py`. Services: `careos-patient-summary` (patient-view) and `careos-medication-safety` (order-select / order-sign). Deterministic, no LLM. Every invocation audited.
5. **Phase 5** — Lab Loop Agent (ORM/ORU correlation, abnormal-result flagging).
6. **Phase 6** — Rx Loop Agent (NewRx via NCPDP / RxNorm via FHIR `MedicationRequest`, dispense-status reconciliation).
7. **Phase 7** — Pilot at one clinic; time-motion + EHR-log study.
