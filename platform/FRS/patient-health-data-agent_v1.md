# Functional Requirements Specification
## Patient-Controlled Health Data Agent with EHR Access Requests

**Version:** 1.0  
**Date:** March 2026  
**Status:** Prototype

---

## 1. Concept

A patient-facing data agent that stores and manages access to a patient's health records. Healthcare organizations (EHR systems) request access through the agent, which:

1. Receives the access request
2. Notifies the patient
3. Allows the patient to approve or deny the request
4. If approved, grants access to the requesting healthcare organization
5. Processes a payment or access fee
6. Enables the healthcare organization to retrieve the patient's records
7. Populates the records into the requesting EHR system

---

## 2. Core Principles

- **Patient-controlled access** — the patient owns and controls their health data
- **Consent-based data sharing** — no access without explicit patient approval
- **Patient verification of clinical records** — patients can review and flag notes
- **Access fees** — organizations pay to retrieve data

---

## 3. System Architecture

### 3.1 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend API | Python / FastAPI                    |
| Frontend    | React (TypeScript) + TailwindCSS    |
| Database    | PostgreSQL                          |
| FHIR Server | Custom FastAPI endpoints (FHIR R4)  |
| Deployment  | Docker / Docker Compose             |
| Server      | 89.167.38.156                       |

### 3.2 Components

#### Patient Agent Application (React)
- View and manage health records
- Receive and respond to access requests (approve/deny)
- Review clinical notes and flag inaccuracies
- View access event logs
- Notification center for incoming requests

#### Patient Data Storage (PostgreSQL)
- Clinical notes
- Diagnoses
- Medications
- Allergies
- Laboratory results
- Historical medical encounters

#### FHIR Resource Server (FastAPI)
- Exposes FHIR R4-compliant API endpoints
- Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter resources
- Authorization-gated access

#### Simulated EHR System (React)
- Request patient records interface
- View request status (pending/approved/denied)
- Payment simulation
- Import and display retrieved records

---

## 4. Data Access Workflow

```
┌─────────────────┐     Step 1: Request Access     ┌──────────────────┐
│  Healthcare Org  │ ─────────────────────────────► │   Patient Agent  │
│  (EHR System)   │                                 │     (API)        │
└─────────────────┘                                 └──────────────────┘
                                                           │
                                                    Step 2: Notify
                                                           │
                                                           ▼
                                                    ┌──────────────────┐
                                                    │  Patient (React) │
                                                    │  Approve / Deny  │
                                                    └──────────────────┘
                                                           │
                                                    Step 3: Decision
                                                           │
                          ┌────────────────────────────────┤
                          │ If Approved                     │ If Denied
                          ▼                                 ▼
                   ┌──────────────┐                  Request Closed
                   │ Payment Fee  │
                   └──────────────┘
                          │
                   Step 4: Auth Token Issued
                          │
                          ▼
                   ┌──────────────────┐
                   │ FHIR API Access  │
                   │ Retrieve Records │
                   └──────────────────┘
                          │
                   Step 5: Import to EHR
                          │
                          ▼
                   ┌──────────────────┐
                   │ Records in EHR   │
                   └──────────────────┘
```

---

## 5. API Endpoints

### 5.1 Access Requests

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/api/access-requests`            | Create a new access request        |
| GET    | `/api/access-requests`            | List all access requests           |
| GET    | `/api/access-requests/{id}`       | Get request details                |
| PATCH  | `/api/access-requests/{id}`       | Approve or deny a request          |

### 5.2 Patient Records

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/patients/{id}`              | Get patient demographics           |
| GET    | `/api/patients/{id}/records`      | Get all records for a patient      |

### 5.3 Clinical Notes

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/clinical-notes`             | List clinical notes                |
| GET    | `/api/clinical-notes/{id}`        | Get a clinical note                |
| PATCH  | `/api/clinical-notes/{id}`        | Approve or flag a clinical note    |

### 5.4 FHIR Resources (Authorized)

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/fhir/Patient/{id}`             | FHIR Patient resource              |
| GET    | `/fhir/Condition?patient={id}`   | FHIR Condition (diagnoses)         |
| GET    | `/fhir/MedicationRequest?patient={id}` | FHIR Medications            |
| GET    | `/fhir/AllergyIntolerance?patient={id}` | FHIR Allergies             |
| GET    | `/fhir/Observation?patient={id}` | FHIR Lab results                   |
| GET    | `/fhir/Encounter?patient={id}`   | FHIR Encounters                    |

### 5.5 Payments

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/api/payments`                   | Process access fee payment         |
| GET    | `/api/payments/{id}`              | Get payment status                 |

### 5.6 Notifications

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/notifications`              | List patient notifications         |
| PATCH  | `/api/notifications/{id}`         | Mark notification as read          |

### 5.7 Access Logs

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/access-logs`                | List all access events             |

---

## 6. Data Models

### Patient
- id, first_name, last_name, date_of_birth, gender, email, phone, address

### ClinicalNote
- id, patient_id, author, date, content, status (pending_review, approved, flagged), patient_comments

### Diagnosis
- id, patient_id, code (ICD-10), description, date_diagnosed, status

### Medication
- id, patient_id, name, dosage, frequency, prescriber, start_date, end_date

### Allergy
- id, patient_id, allergen, reaction, severity

### LabResult
- id, patient_id, test_name, value, unit, reference_range, date, status

### Encounter
- id, patient_id, date, provider, location, type, summary

### AccessRequest
- id, patient_id, requesting_org_id, requesting_org_name, purpose, status (pending, approved, denied), created_at, resolved_at

### Payment
- id, access_request_id, amount, status (pending, completed, failed), created_at

### Notification
- id, patient_id, type, message, read, created_at, access_request_id

### AccessLog
- id, patient_id, requesting_org_id, action, timestamp, details

### Organization
- id, name, type, contact_email, ehr_system_name

---

## 7. Patient Record Verification

When new clinical notes are created:
1. The agent receives the note
2. The patient is notified
3. The patient reviews and can:
   - Approve the note
   - Flag inaccuracies
   - Add comments

---

## 8. Prototype Demonstration Scenario

1. A simulated healthcare system (e.g., "Metro General Hospital") requests patient records
2. The patient receives an approval notification in their dashboard
3. The patient reviews and approves the request
4. Payment is simulated ($25 access fee)
5. The healthcare system retrieves FHIR resources via the API
6. The retrieved data appears in the simulated EHR interface

---

## 9. Prototype Deliverables

- Patient-facing React application (Patient Agent)
- Simulated EHR system React application
- FastAPI backend with FHIR resource server
- PostgreSQL database with seed data
- Docker Compose deployment configuration
- Documentation and README
