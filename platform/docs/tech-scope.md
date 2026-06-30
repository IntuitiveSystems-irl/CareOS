# CareOS — Technical Scope

> **Version:** 1.0 · **Date:** June 2026  
> **Maintainer:** LaunchFlow / Business Intuitive Inc.  
> **Live deployment:** <https://launchflow.tech>  
> **Repository:** <https://github.com/IntuitiveSystems-irl/CareOS>

---

## 1. What CareOS is

CareOS is a **patient-mediated clinical operating system** — not an EHR, not a patient portal bolt-on. It sits *between* existing EHRs and the patient, absorbing the ~30,000 administrative actions a 4,000-visit outpatient clinic generates each year by routing intake, orders, results, records, and research participation through a standards-based, HIPAA-grade relay.

The system is designed around one organizing principle: **the patient is the permission layer**. FHIR Consent resources gate every data movement; no PHI leaves the canonical store without a patient-authorized scope.

---

## 2. In-scope surfaces

| Surface | Audience | Status |
|---|---|---|
| Marketing site / landing page | CIOs, clinics, investors | ✓ Live |
| Clinician EHR portal | Clinicians, front-desk staff | ✓ Live |
| Patient portal | Patients | ✓ Live |
| Patient check-in / QR scanner | Front desk + patients | ✓ Live |
| Order composer + order status | Clinicians | ✓ Live |
| Work queue | Clinicians | ✓ Live |
| CDS decision support | Clinicians (in-workflow) | ✓ Live |
| EHR connections manager | Admin / IT | ✓ Live |
| Research network dashboard | Researchers, IRB staff | ✓ Live |
| Live global data pool | Public / researchers | ✓ Live |
| Clinic waiting room scoreboard | Patients (public display) | ✓ Live |
| FHIR Standards Explorer | Developers, informatics | ✓ Live |
| Patient Fishbowl™ transparency view | Patients | ✓ Live |
| AI consent assistant (ai-layer) | Patients | ✓ Live (optional service) |

---

## 3. Out of scope (explicit exclusions)

| Item | Reason |
|---|---|
| **Billing / RCM** | Requires payer-specific integrations outside current scope |
| **Prescribing (e-Rx)** | Surescripts certification required; roadmap item |
| **Clinical documentation (SOAP notes)** | EHR responsibility; CareOS surfaces orders/results only |
| **Direct EHR write-back** | Read-only relay in v1; FHIR write operations are roadmap |
| **Payer / prior auth workflows** | X12 EDI out of scope for v1 |
| **Medical device integration** | HL7 v2 inbound only; direct device protocols out of scope |
| **LLM in the clinical path** | Deterministic agents only; no LLM touches the canonical record |
| **Webcam / biometric data** | Explicitly blocked at nginx CSP (`camera=()`) |
| **Cryptocurrency / on-chain payments** | Research reward escrow is off-chain; no live smart contracts |

---

## 4. Technology stack

### 4.1 Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.4 |
| Build tool | Vite | 5.1 |
| Routing | React Router | 6.22 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 11.5 |
| Icons | Lucide React | 0.344 |
| HTTP client | Fetch API (custom `api.ts` wrapper) | — |
| WebSocket | Native browser WebSocket | — |
| Fonts | Inter (body) · Space Grotesk (display) | Google Fonts |

### 4.2 Backend

| Layer | Technology | Version |
|---|---|---|
| Framework | FastAPI | 0.110+ |
| Language | Python | 3.11+ |
| ORM | SQLAlchemy | 2.x (async) |
| Database | PostgreSQL | 15 |
| Auth | JWT (HS256) · SMART on FHIR Bearer | — |
| Email | Resend API | — |
| Task queue | In-process async (no Celery in v1) | — |
| HL7 listener | Custom asyncio MLLP server | — |

### 4.3 AI Layer (optional, patient-facing only)

| Layer | Technology |
|---|---|
| Framework | FastAPI (standalone service) |
| LLM | OpenAI GPT-4o (consent explanation only) |
| Scope | `explain_consent`, `summarize_data` — never writes clinical record |

### 4.4 Infrastructure

| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Reverse proxy | Nginx (HTTP-only; TLS terminated by Cloudflare) |
| TLS / tunneling | Cloudflare Tunnel (launchflow.tech) |
| Local dev host | macOS + Docker Desktop |
| Production target | VPS (89.167.38.156) — currently using local + Cloudflare Tunnel |
| Static assets | Served by Nginx from Vite build output (`dist/`) |
| Database persistence | Docker volume (`postgres_data`) |

---

## 5. Standards conformance

| Standard | Implementation status |
|---|---|
| **FHIR R4** | Core resource store: Patient, Observation, Condition, MedicationRequest, DiagnosticReport, DocumentReference, Consent, Coverage, AllergyIntolerance, Encounter, Procedure, Immunization, Device, Practitioner, Organization, Location, Schedule, Slot, Appointment, ServiceRequest, CarePlan, Goal |
| **SMART on FHIR** (EHR launch + standalone) | ✓ Authorization server, PKCE, scope enforcement |
| **SMART Backend Services** (Epic system-to-system) | ✓ JWT client assertion, JWKS endpoint |
| **HL7 v2.5 / MLLP** | ✓ Inbound listener (ADT, ORM, ORU, MDM message types) |
| **USCDI v3** | ✓ All v3 data classes mapped to FHIR R4 profiles |
| **FHIR Bulk Data (`$export`)** | ✓ Async NDJSON export, Group-level and Patient-level |
| **CDS Hooks** | ✓ Discovery + `patient-view`, `order-select`, `order-sign` hooks |
| **TEFCA / QHIN** | Architecture ready; certification is a roadmap milestone |
| **HIPAA §164.312(b)** | ✓ Tamper-evident audit chain (SHA-256 hash-chained event log) |
| **21st Century Cures Act** | ✓ No information blocking; patient-authorized data release |
| **AES-256-GCM** | ✓ Encryption at rest for PHI in cloud archive transport |

---

## 6. API surface

### 6.1 Public / authenticated REST endpoints (prefix: `/api`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | System health + KEK fingerprint |
| `POST` | `/api/auth/login` | Clinician JWT login |
| `GET` | `/api/patients` | Paginated patient list |
| `GET` | `/api/patients/{id}` | Single patient record |
| `GET` | `/api/patients/{id}/fhir-bundle` | Full FHIR R4 bundle |
| `POST` | `/api/checkin/accept` | Clinic accept check-in, triggers pool contribution |
| `GET` | `/api/orders` | Order list |
| `POST` | `/api/orders` | Create order |
| `GET` | `/api/work-queue` | Unresolved work queue items |
| `GET` | `/api/audit-log` | Hash-chained audit events |
| `GET` | `/api/pool/summary` | Aggregated research pool stats |
| `GET` | `/api/pool/board` | Clinician-validated board contributions |
| `POST` | `/api/contributions/{id}/validate` | Clinician sign-off on contribution |

### 6.2 FHIR endpoints (prefix: `/fhir`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/fhir/metadata` | CapabilityStatement |
| `GET` | `/fhir/Patient/{id}` | FHIR Patient read |
| `GET` | `/fhir/Patient/{id}/$everything` | Patient everything operation |
| `GET` | `/fhir/Group/{id}/$export` | Bulk data async export |
| `GET` | `/fhir/Consent/{id}` | Consent resource read |

### 6.3 SMART auth endpoints (prefix: `/auth`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/authorize` | OAuth2 authorization endpoint |
| `POST` | `/auth/token` | Token exchange (code + client_credentials) |
| `GET` | `/.well-known/smart-configuration` | SMART discovery |
| `GET` | `/.well-known/jwks.json` | Public JWKS for Backend Services |

### 6.4 CDS Hooks endpoints (prefix: `/cds-services`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/cds-services` | Hook discovery |
| `POST` | `/cds-services/patient-view` | Patient context cards |
| `POST` | `/cds-services/order-select` | Order-time advisory cards |
| `POST` | `/cds-services/order-sign` | Pre-sign compliance cards |

### 6.5 WebSocket

| Path | Description |
|---|---|
| `/ws/patient/{id}` | Real-time patient workflow status updates |
| `/ws/audit` | Live audit chain feed |

---

## 7. Data model highlights

### Core tables (PostgreSQL)

| Table | Purpose |
|---|---|
| `patients` | Canonical patient demographics + FHIR ID |
| `fhir_resources` | JSON store for all FHIR R4 resources |
| `hl7_messages` | Raw inbound HL7 v2 messages + parse status |
| `orders` | Order lifecycle (pending → sent → resulted) |
| `audit_log` | Hash-chained PHI event log (HIPAA §164.312(b)) |
| `consents` | Patient FHIR Consent records |
| `pool_contributions` | De-identified research pool entries |
| `clinician_validations` | Clinician sign-off records for pool entries |
| `research_participants` | IRB study participant records |
| `research_access_audit` | Gated researcher access log (R-6) |
| `wallet_transactions` | Research reward ledger (off-chain) |

### Key design decisions

- **Single canonical FHIR store** — all inbound data (HL7 v2, FHIR R4, SMART pull) normalizes into one `fhir_resources` table. No duplicate patient records.
- **Hash-chained audit** — every PHI access event stores `SHA-256(prev_hash + event_json)`. Tampering breaks the chain.
- **Zero PHI on public endpoints** — the research pool and scoreboard endpoints return only de-identified, clinician-validated aggregates.
- **No LLM in the clinical path** — `IntakeAgent`, `LabLoopAgent`, `RxLoopAgent` are deterministic rule engines. The only LLM is the optional `ai-layer` consent assistant, which never writes the canonical record.

---

## 8. Security controls summary

| Control | Implementation |
|---|---|
| Auth | JWT (HS256), SMART Bearer, PKCE |
| Transport | TLS 1.2/1.3 via Cloudflare (all traffic) |
| Encryption at rest | AES-256-GCM (cloud archive); PostgreSQL volume encryption |
| Audit | Hash-chained event log, immutable append-only |
| Rate limiting | Nginx `limit_req` on research auth + results endpoints |
| Header security | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict CSP, `Permissions-Policy: camera=()` |
| PHI exposure | Zero PHI on public/research endpoints; all public data is de-identified aggregates |
| Secrets management | All secrets via environment variables; no secrets in git history |

Full detail: [`security/SECURITY_POLICY.md`](./security/SECURITY_POLICY.md) and [`security/COMPLIANCE_MATRIX.md`](./security/COMPLIANCE_MATRIX.md).

---

## 9. Deployment topology

```
Internet
    │
    ▼
Cloudflare (TLS termination + DDoS)
    │
    ▼
cloudflared tunnel (launchflow.tech → localhost:8082)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Docker Compose (docker-compose.local.yml)           │
│                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────┐  │
│  │  frontend   │   │   backend   │   │ ai-layer │  │
│  │  Nginx:80   │   │ FastAPI:8000│   │ FastAPI  │  │
│  │  →host:8082 │   │ →host:8001  │   │ :8100    │  │
│  └─────────────┘   └─────────────┘   └──────────┘  │
│          │                │                          │
│          └────────────────┤                          │
│                           ▼                          │
│                  ┌─────────────────┐                 │
│                  │   PostgreSQL 15 │                 │
│                  │   port 5432     │                 │
│                  └─────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## 10. Roadmap (out of current scope)

| Item | Phase |
|---|---|
| FHIR write-back to EHR (update/create) | Phase 2 |
| CDS Hooks outbound (EHR-embedded cards) | Phase 3 |
| TEFCA / QHIN certification | Phase 3 |
| e-Rx (Surescripts) | Phase 3 |
| Research escrow smart contracts (on-chain) | Phase 4 |
| Per-user MFA (beyond shared passcode) | Phase 2 |
| Column-level PHI encryption (R-5) | Phase 2 |
| Production VPS restore + backup cron | Phase 2 |

---

## 11. Related documents

| Document | Location |
|---|---|
| Architecture deep-dive | [`docs/careos-architecture.md`](./careos-architecture.md) |
| FHIR compliance audit | [`docs/fhir-compliance-audit.md`](./fhir-compliance-audit.md) |
| FHIR modules map | [`docs/fhir-modules-map.md`](./fhir-modules-map.md) |
| Security policy (IRB-aligned) | [`docs/security/SECURITY_POLICY.md`](./security/SECURITY_POLICY.md) |
| Compliance matrix | [`docs/security/COMPLIANCE_MATRIX.md`](./security/COMPLIANCE_MATRIX.md) |
| Design system | [`docs/design-system.html`](./design-system.html) |
| SMART App Gallery application | [`docs/careos-application.md`](./careos-application.md) |
| EHR API links | [`docs/ehr-api-links.md`](./ehr-api-links.md) |
