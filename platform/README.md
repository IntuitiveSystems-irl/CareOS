# Patient-Controlled Health Data Agent

A patient-facing data agent that stores and manages access to health records using **SMART on FHIR** standards. Healthcare organizations request access through the agent, which handles AI-assisted consent workflows, OAuth token issuance, payment processing, and FHIR-based data retrieval.

## Architecture (5 Docker Services)

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Frontend   │    │  Backend   │    │  AI Layer  │
│  (React)    │◄──►│  (FastAPI) │◄──►│  (FastAPI)  │
│  Port 80    │    │  Port 8000 │    │  Port 8100 │
└────────────┘    └─────┬──────┘    └────────────┘
                        │                    │
                  ┌─────▼──────┐    ┌────────▼───┐
                  │  Database  │    │ Custom GPT  │
                  │ (Postgres) │    │  (Actions)  │
                  │  Port 5432 │    └─────────────┘
                  └─────▲──────┘
                        │
                  ┌─────┴──────┐
                  │ Data Model │
                  │ (Migrations│
                  │  + Seed)   │
                  └────────────┘
```

| Service | Technology | Purpose |
|---------|-----------|---------|
| **Database** | PostgreSQL 16 | Persistent data store |
| **Data Model** | Python + SQLAlchemy + Alembic | Schema migrations and demo seed data |
| **Backend** | Python / FastAPI | API server, SMART on FHIR auth, FHIR resource server, WebSocket |
| **AI Layer** | Python / FastAPI + OpenAI | GPT Actions backend — consent explanation, data summarization |
| **Frontend** | React + TypeScript + TailwindCSS | Patient Agent + simulated EHR system UI |

## Key Features

- **SMART on FHIR OAuth** — Full authorization flow: discovery, authorize, token exchange, introspection
- **AI-Assisted Consent** — GPT explains requests, summarizes data, helps patients decide
- **Primary vs Secondary Use** — Distinguishes direct care from research/QI/public health requests
- **Approve with Limits** — Patients can restrict time window, access duration, and data categories
- **Open Notes** — Patients review clinical notes with AI plain-language translation and verification checklists
- **Data Access Log** — Transparent view of all data access with organization, use type, scopes, and token info
- **Clinician View** — Simulated EHR widget showing real-time access request status and FHIR record retrieval
- **Fulfillment Routing** — Post-visit task routing: labs, prescriptions, referrals, insurance packets via connector stubs
- **Patient Preferences** — Choose preferred lab, pharmacy, specialist, and payer for automatic routing
- **Connector Framework** — Pluggable stub adapters (lab, pharmacy, provider, insurance) ready for real integration
- **EHR Vendor Adapters** — Epic, Cerner (Oracle Health), and MEDITECH adapters with SMART on FHIR discovery, OAuth token handling, and vendor-specific FHIR resource access (structured stubs)
- **Custom GPT Actions** — OpenAPI schema at `/ai/openapi-actions.json` for GPT Builder
- **Real-Time Notifications** — WebSocket push when hospitals request access
- **NFC/QR Launch** — Tap-to-start consent sessions; data moves over HTTPS/FHIR
- **Access Fee Simulation** — Payment required before token issuance
- **FHIR R4 Resources** — Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter

## Quick Start

```bash
# Clone and start all 5 services
cd patient-health-agent
docker compose up --build

# Access points:
# Frontend:        http://localhost
# Backend API:     http://localhost:8000/docs
# AI Layer:        http://localhost:8100/docs
# SMART Discovery: http://localhost:8000/.well-known/smart-configuration
```

To use the AI layer with real GPT responses, set your OpenAI key:
```bash
OPENAI_API_KEY=sk-your-key docker compose up --build
```

## Deploy to Server (89.167.38.156)

```bash
scp -r patient-health-agent/ user@89.167.38.156:~/
ssh user@89.167.38.156
cd patient-health-agent
docker compose up -d --build
```

## Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://agent:agent_secret@localhost:5432/patient_agent
uvicorn app.main:app --reload --port 8000
```

### AI Layer
```bash
cd ai-layer
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://agent:agent_secret@localhost:5432/patient_agent
export BACKEND_URL=http://localhost:8000
uvicorn main:app --reload --port 8100
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## Demo Walkthrough

### Standard Flow
1. **Open Patient Agent** (`/patient`) — view patient dashboard with pending requests
2. **Review Access Requests** (`/patient/requests`) — see primary care and secondary use requests
3. **AI Explain** — click "AI Explain This Request" for plain-language breakdown with risk summary
4. **Approve / Approve with Limits / Deny** — set time window, duration, and data categories
5. **Real-time WebSocket notification** — patient sees request arrive live
6. **Switch to EHR System** (`/ehr`) — simulated hospital EHR
7. **Clinician View** (`/ehr/clinician`) — monitor requests in real-time, fetch FHIR records when approved
8. **Review Clinical Notes** (`/patient/notes`) — read notes, get AI plain-language translation, use verification checklist, approve or flag with comments
9. **Data Access Log** (`/patient/access-log`) — filter by use type, see organization, scopes, token info
10. **View Audit Trail** (`/patient/logs`) — full access log

### Secondary Use Flow
1. Organization sends access request with `use_type=secondary_use` and `secondary_purpose=research`
2. Patient sees purple "Secondary Use" and "Research" badges
3. AI explanation warns this may not benefit personal care
4. Patient approves with limits: last 12 months, one-time access, conditions + observations only

### Fulfillment Routing Flow
1. **Set Preferences** (`/patient/preferences`) — choose preferred lab, pharmacy, specialist, payer
2. **Visit Fulfillment** (`/patient/fulfillment`) — view fulfillment packet with task checklist
3. **Send Now** — tasks route through connector stubs to destinations
4. **Track Status** — queued → sent → acknowledged → completed (per task)
5. **AI Summary** — click "AI Summary" for patient-friendly checklist + what to expect
6. **Clinician View** (`/ehr/clinician`) — shows fulfillment status (Labs routed / Rx routed / Referral sent / Prior auth initiated)

### EHR Vendor Adapters
Each demo organization is configured with a different EHR vendor:
- **Metro General Hospital** — Epic (FHIR R4, `.well-known/smart-configuration`)
- **Riverside Family Medicine** — Cerner / Oracle Health (FHIR R4, explicit scopes, no wildcards)
- **Pacific Specialty Group** — MEDITECH Expanse (US Core STU7, `CapabilityStatement` discovery)

API endpoints for adapter introspection:
- `GET /api/ehr-adapters/org/{id}/info` — Full adapter info (vendor, SMART config, scopes, resources)
- `GET /api/ehr-adapters/org/{id}/smart-config` — Discovered SMART endpoints
- `GET /api/ehr-adapters/org/{id}/resources` — Supported FHIR resources for this vendor
- `POST /api/ehr-adapters/org/{id}/fetch/{ResourceType}` — Simulated FHIR resource fetch via vendor adapter

### NFC/QR Flow
1. Patient taps NFC tag at hospital → launches consent session URL
2. AI Layer creates session, pushes notification to patient
3. Patient reviews AI explanation and approves/denies
4. Server-to-server FHIR transfer over HTTPS (not NFC)

## SMART on FHIR Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/smart-configuration` | GET | SMART discovery document |
| `/fhir/metadata` | GET | FHIR CapabilityStatement with SMART security |
| `/auth/authorize` | GET | Authorization endpoint (issues auth codes) |
| `/auth/token` | POST | Token exchange (auth code → Bearer token) |
| `/auth/introspect` | POST | Token introspection / validation |

## Epic Backend Services (Outbound)

LaunchFlow can also act as a **SMART client** of Epic using the
[Backend Services profile](https://hl7.org/fhir/smart-app-launch/backend-services.html)
— a JWT-bearer `client_credentials` grant. This lets the agent pull live
records from Epic's sandbox (and, with the production client ID, from real
hospitals).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/jwks.json` | GET | Public JWK Set (non-prod) — register with Epic |
| `/.well-known/jwks-prod.json` | GET | Public JWK Set (prod) |
| `/api/epic-backend/defaults` | GET | Client ID, token endpoint, FHIR base, default scopes |
| `/api/epic-backend/test` | GET | One-shot integration test (sign JWT → token → optional Patient.Search) |
| `/api/epic-backend/backend-fetch` | POST | Full E2E: token → Patient.Search → fetch 9 FHIR resources → persist |
| `/api/epic-backend/hospitals?q=&limit=` | GET | Search the 481-hospital Epic directory |
| `/api/epic-backend/fhir-data/{connection_id}` | GET | Summary of persisted FHIR data |

**Setup:**
```bash
cd backend/
./scripts/generate_backend_keys.sh    # one-time: creates .data/keys/private.pem
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/.well-known/jwks.json   # confirm JWKS is served
```

Then register the JWKS URL at Epic's Backend Systems app config and wait
30–60 minutes for propagation before `/api/epic-backend/test` returns a
successful token.

**Test (no real Epic registration required — uses Epic's published sandbox client):**
```bash
curl http://localhost:8000/api/epic-backend/test?useTestPatient=1
```

## GPT Actions (AI Layer)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/consent/explain` | POST | Explain a consent request (primary/secondary aware) |
| `/consent/summarize-data` | POST | Summarize what data would be shared |
| `/consent/decide` | POST | Record patient's approve/deny/approve-with-limits decision |
| `/notes/translate` | POST | Translate clinical note to plain language |
| `/notes/verify` | POST | Generate accuracy verification checklist |
| `/fulfillment/summarize` | POST | Patient-friendly fulfillment packet summary |
| `/session/initiate-nfc` | POST | Create NFC/QR consent session |
| `/session/status` | POST | Check consent session status |
| `/audit/log` | POST | Log an AI interaction |
| `/openapi-actions.json` | GET | OpenAPI schema for GPT Builder |

## Setting Up a Custom GPT

1. Go to [GPT Builder](https://chat.openai.com/gpts/editor)
2. Create a new GPT with instructions for patient consent assistance
3. Add **Actions** → Import from URL: `http://your-domain:8100/openapi-actions.json`
4. Configure OAuth if needed (client_id/secret from your organization record)
5. The GPT can now explain consent, summarize data, and trigger approvals

## Project Structure

```
patient-health-agent/
├── docker-compose.yml          # 5-service orchestration
│
├── data-model/                 # Service 1: Schema + migrations
│   ├── Dockerfile
│   ├── models.py               # SQLAlchemy models (shared schema)
│   ├── run_migrations.py       # Create tables + seed demo data
│   ├── alembic.ini
│   └── alembic/
│
├── backend/                    # Service 2: Core API
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py           # SQLAlchemy models (with SMART on FHIR)
│       ├── schemas.py          # Pydantic schemas
│       ├── seed.py
│       └── routers/
│           ├── patients.py
│           ├── organizations.py
│           ├── access_requests.py
│           ├── clinical_notes.py
│           ├── payments.py
│           ├── notifications.py
│           ├── access_logs.py
│           ├── fhir.py         # FHIR R4 + Bearer token auth
│           ├── smart_auth.py   # SMART on FHIR OAuth server
│           ├── websocket.py    # Real-time push notifications
│           ├── patient_portal.py # Access log, notes, note reviews
│           ├── fulfillment.py  # Packets, tasks, destinations, preferences
│           └── ehr_adapters.py # Vendor adapter info + SMART discovery routes
│       ├── connectors/
│       │   ├── base.py         # BaseConnector + SendResult interface
│       │   ├── router.py       # Task router (selects connector by type)
│       │   ├── lab_connector.py
│       │   ├── pharmacy_connector.py
│       │   ├── provider_connector.py
│       │   └── insurance_connector.py
│       └── connectors/ehr/     # EHR Vendor Adapters
│           ├── base_ehr_adapter.py  # SMART discovery + OAuth + FHIR fetch interface
│           ├── ehr_router.py        # Selects adapter by org.ehr_vendor
│           ├── epic_adapter.py      # Epic FHIR R4 (USCDI, Bulk Data)
│           ├── cerner_adapter.py    # Cerner SMART on FHIR (explicit scopes)
│           └── meditech_adapter.py  # MEDITECH Argonaut R2 + US Core STU7
│
├── docs/
│   └── ehr-api-links.md        # Epic, Cerner, MEDITECH API reference links
│
├── ai-layer/                   # Service 3: AI / GPT Actions
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI with GPT Action endpoints
│   ├── models.py               # Shared SQLAlchemy models
│   └── .env.example
│
├── frontend/                   # Service 4: React SPA
│   ├── Dockerfile
│   ├── nginx.conf              # Reverse proxy config
│   └── src/
│       ├── pages/patient/      # Dashboard, Records, Notes, Requests, Logs, AccessLog, Fulfillment, Preferences
│       └── pages/ehr/          # Dashboard, RetrievedRecords, ClinicianView (+fulfillment status)
│
└── FRS/
    └── patient-health-data-agent.md
```
