# Online Research Security & Compliance Policy (IRB-Aligned)

**System:** CareOS EHR Usability Study — research module of the CareOS / launchflow.tech platform
**Document owner:** Principal Investigator (PI) — _[NAME]_
**Institution / IRB:** _[INSTITUTION]_ — IRB Protocol _[PROTOCOL #]_
**Version:** 1.0 · **Effective date:** _[DATE]_ · **Review cadence:** annually or on protocol amendment

> Placeholders in _[brackets]_ must be completed before this document is submitted as part of an
> IRB protocol packet or institutional SOP. Technical control references (file paths, service
> names) describe the system **as implemented** so this policy is auditable, not aspirational.
> Current control status is tracked in the companion `COMPLIANCE_MATRIX.md`.

---

## 1. Purpose
This policy defines the security, privacy, and compliance requirements for all online research
activities conducted through the CareOS research module. It ensures that digital data collection,
storage, analysis, and transmission meet IRB expectations, protect participant confidentiality, and
maintain the integrity and availability of research data.

## 2. Scope
This policy applies to:

- The online study delivered at `https://launchflow.tech/research/*` (consent, demographics, the
  instrumented exploration phase, timed task blocks, NASA-TLX workload, usability, and open-ended
  questions).
- The researcher analytics dashboard and data-export endpoints (`/api/research/results/*`).
- All cloud-hosted components that collect, store, process, or transmit participant data
  (FastAPI backend, PostgreSQL database, nginx reverse proxy, Docker host VPS).
- Third-party services in the data path (transactional email, AI tooling, hosting, TLS issuance).
- All study personnel: PI, co-investigators, research assistants, analysts, and external
  collaborators with any level of access.

**Explicitly out of scope / not collected:** No patient health information (PHI) is collected — the
study uses a synthetic patient record. No webcam, microphone, camera, or biometric data is captured
(blocked at the platform layer; see Appendix B).

## 3. Shared Responsibility Model
Research activities rely on third-party vendors (hosting, email delivery, AI tooling, TLS issuance).
Under IRB and institutional policy:

- **Vendors** secure their underlying infrastructure.
- **The research team** secures the data, access, configuration, and ethical use that sit on top of
  that infrastructure.

Responsibilities the research team retains regardless of provider:

- Protecting participant confidentiality and honoring consent.
- Secure configuration of all systems (backend, database, proxy, host).
- Identity and access management for study personnel.
- Endpoint/device security for anyone accessing data.
- Compliance with the IRB-approved protocol and this policy.

The research team retains accountability for **all** collected research data.

## 4. Data Classification
All research data is classified before collection. Higher levels require stronger controls
(encryption, restricted access, audit logging, separation from responses).

| Level | Definition | Examples in this study |
|-------|------------|------------------------|
| **L1 — Non-identifiable** | Cannot reasonably identify a person | Aggregate metrics, anonymized task accuracy/timing |
| **L2 — Coded / pseudonymous** | Identifiers replaced by a code; key held separately | `participant_code`, demographics (role, specialty, years of experience, primary EHR, hours/week, age range), design preference, telemetry (clicks, scroll depth, dwell/attention, time-on-task), NASA-TLX, usability ratings, qualitative free-text |
| **L3 — Identifiable / sensitive** | Direct identifiers or data raising re-identification risk | Participant full name, email address, typed consent signature |

**Data minimization:** Only `full_name` and `email` (L3) are collected, solely to allow participants
to resume a session and to enable study-team contact (scheduling/compensation). They are **not**
required to analyze results and must be separable from the response dataset (see §5 Data Security).

## 5. Defense-in-Depth Security Controls

### 5.1 Identity & Access Management
- **MFA is required** for all administrative accounts that can reach research data (hosting/VPS,
  database, source control, email vendor, cloud storage) wherever the provider supports it.
- Access to the researcher dashboard and exports is limited to **IRB-approved study personnel** only.
- **No shared accounts.** Each person must have a unique, individually attributable login. _(Target
  state — see remediation R-2; the current shared passcode is an interim control.)_
- Access is granted on the **principle of least privilege** and **revoked immediately** when a person
  leaves the study or no longer needs it.
- The researcher gate is **fail-closed**: if no credential is configured, researcher access is denied
  (`app/research/auth.py`).

### 5.2 Device Security
- Research data may only be accessed on **password-protected, full-disk-encrypted** devices
  (FileVault on macOS, BitLocker on Windows, LUKS on Linux).
- Operating systems and browsers must be kept **current with security patches**.
- **Endpoint protection** (antivirus/EDR) must be enabled.
- Devices must auto-lock when idle; data must not be cached or downloaded to unmanaged devices.

### 5.3 Network & Cloud Security
- All participant- and researcher-facing traffic uses **HTTPS/TLS only**. HTTP is 301-redirected to
  HTTPS, and **HSTS** (`max-age=63072000; includeSubDomains; preload`) is enforced.
- Only the nginx reverse proxy is publicly exposed; the **database and API ports are bound to
  loopback** (`127.0.0.1`) on the host and are not reachable from the internet.
- Access to admin surfaces (database, hosting console) from outside the host requires an SSH tunnel
  or **VPN**; never administer over public/untrusted Wi-Fi without one.
- Cloud storage holding study data must require authentication; **public/anonymous links are
  prohibited**.
- External sharing of any participant data requires PI approval and must comply with the IRB protocol.

### 5.4 Data Security
- Data is encrypted **in transit** (TLS 1.2/1.3) and **at rest** (encrypted host volume; column- or
  application-level encryption for L3 identifiers is the target state — see remediation R-5).
- **Identifiers are stored separately from responses** wherever possible: response tables
  (task attempts, workload, usability, qualitative, exploration) reference participants only by a
  numeric/coded key, keeping direct identifiers logically separated from the analysis data.
- **De-identification / pseudonymization** (`participant_code`) is used for analysis and export;
  re-identification keys are access-controlled.
- **Secrets** (API keys, database passwords, the researcher passcode) are injected from the host
  environment, **never committed to source control**, and stored only in an approved secret manager.

## 6. Confidentiality, Integrity, and Availability (CIA)

### Confidentiality
- Only authorized personnel may access participant data.
- Participant data must **not** be emailed or shared through unapproved channels.
- Screens displaying identifiable or raw data must be protected from shoulder-surfing.

### Integrity
- Raw data is preserved in its original form; analysis works on copies.
- Changes to datasets must be **documented, version-controlled, and auditable**.
- Application code is version-controlled in Git with reviewed changes.

### Availability
- The database is **backed up on a regular schedule** to encrypted, access-controlled storage, with a
  **documented and tested restore procedure** (target state — remediation R-4).
- TLS certificates **auto-renew** (certbot, every 12h) so the service does not lapse.
- Recovery procedures exist for accidental deletion or outage.

## 7. Zero Trust Access Principles
- **Verify explicitly:** no user, device, or network is automatically trusted.
- **Least privilege** is enforced for every account and service-to-service call.
- Access is **reviewed quarterly** and at major study milestones; stale access is removed.
- **Unusual activity is investigated and documented** (see §12 Incident Response).

## 8. Secure Data Handling & Encryption
- **At rest:** encrypted host storage / encrypted cloud storage; L3 identifiers additionally protected
  per remediation R-5.
- **In transit:** HTTPS/TLS for all collection, transfer, and administration.
- **Backups:** encrypted and stored in an institution-approved location.
- **Passwords/keys:** stored only in a secure password/secret manager; never shared in plaintext or
  over chat/email.
- **Disposal:** secure deletion (cryptographic wipe or vendor-attested deletion) per §10.

## 9. AI Use in Research
- **No identifiable participant data (L3)** may be entered into public/third-party AI systems unless
  explicitly approved by the IRB.
- AI tool outputs must be **reviewed by a human researcher** before use in analysis or reporting.
- AI tools may **not** autonomously interact with participants or make decisions affecting them.
- Before use, each AI tool is evaluated for **data retention, model-training-on-inputs, and privacy**
  terms; tools that train on submitted data are not permitted for participant data.
- The study's AI assistant component is informational only and operates on synthetic, non-participant
  data; participant research records are not transmitted to it.

## 10. Vendor & Platform Risk Review
Before adopting any online platform that touches participant data, the team verifies and records:

- Data storage location (US vs. international).
- Encryption standards (in transit and at rest).
- Data retention and deletion policies.
- Whether the vendor uses submitted data for training or analytics.
- Whether the vendor meets institutional/IRB requirements.

Platforms handling identifiable data must be **institutionally approved**. The current vendor
inventory and risk dispositions are maintained in `COMPLIANCE_MATRIX.md` (Appendix: Vendor Register).

## 11. Informed Consent Security
- Digital consent clearly states data risks and protections (including that on-screen interactions
  are recorded and that **no webcam/camera is used**).
- Consent records (`consent_given`, typed signature, timestamp) are stored securely and access-
  controlled.
- Consent logs are protected from unauthorized access and alteration.
- **Withdrawal requests are honored and documented**, and the participant's data is handled per the
  IRB-approved withdrawal procedure.

## 12. Incident Response
Any suspected or confirmed security incident — lost/stolen device, unauthorized access, accidental
disclosure, misconfigured cloud permissions, or leaked credential — must be reported **immediately**
to the PI _[NAME, CONTACT]_ and the institutional information-security office _[CONTACT]_.

Response steps:
1. **Contain** — restrict access to affected systems/accounts; rotate exposed credentials.
2. **Assess** — identify and isolate affected data and its classification level.
3. **Document** — record timeline, scope, root cause, and actions taken.
4. **Notify** — determine IRB and institutional/legal reporting obligations and notify within
   required timeframes.
5. **Remediate** — implement corrective actions and verify.

A short operational runbook is maintained alongside this policy; report first, investigate second.

## 13. Data Retention & Secure Disposal
- Data is retained only for the **IRB-approved duration** and institutional requirements.
- **Direct identifiers (L3) are removed as soon as they are no longer needed** for contact/scheduling.
- At study completion, data is **securely deleted or archived** per institutional policy; deletion of
  cloud/vendor data is requested and confirmed.
- **Departing personnel lose access immediately.**

## 14. Training & Compliance
All study personnel must complete, before receiving access:

- **Human-subjects protection training** (e.g., CITI).
- **Institutional data-security training.**
- **Study-specific onboarding** for secure data handling under this policy.

Non-compliance may result in removal from the study. This policy is reviewed at least annually and
upon any IRB protocol amendment.

---

## Appendix A — System Architecture & Data Inventory

**Topology (single VPS, Docker Compose):** nginx (public 80/443, TLS termination, security headers)
→ FastAPI backend (`127.0.0.1:8000`) → PostgreSQL (`127.0.0.1:5432`, named volume). Auxiliary
services (AI layer, integration relay) are loopback-bound and not part of the research data path.

**Research data stores (PostgreSQL):**

- `research_participants` — L3 (`full_name`, `email`, typed consent signature) + L2 (`participant_code`,
  demographics, `style_preference`, consent flags/timestamps).
- `research_task_attempts`, `research_workload_assessments`, `research_qualitative_responses`,
  `research_usability_assessments`, `research_exploration_metrics`, `research_interaction_events` —
  L1/L2 responses, keyed by `participant_id`.

**Export surface:** `GET /api/research/results/export.csv|json` and `/results/*` — researcher-gated.

## Appendix B — Control Implementation Reference

| Control | Where implemented |
|---------|-------------------|
| TLS 1.2/1.3, HSTS preload, HTTP→HTTPS redirect | `nginx-security.conf` |
| Security headers (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy) | `nginx-security.conf` |
| Camera/mic/geolocation disabled site-wide (`Permissions-Policy`) | `nginx-security.conf` |
| Dotfile/secret-path blocking (`/.env`, `/.git`) | `nginx-security.conf` |
| DB + API bound to loopback (no public exposure) | `docker-compose.yml` (ports `127.0.0.1:…`) |
| CORS origin allowlist | `app/main.py`, `CORS_ORIGINS` |
| Researcher gate (fail-closed, constant-time compare) | `app/research/auth.py` |
| Pseudonymous participant code; responses keyed by id | `app/research/models.py` |
| TLS auto-renewal | `docker-compose.yml` (`certbot` service) |
| Secrets via host environment (passcode, KEK, AI/email keys) | `docker-compose.yml` (`${VAR}` interpolation) |

## Appendix C — Definitions
- **PHI:** Protected Health Information. **Not collected** in this study.
- **Pseudonymization:** Replacing identifiers with a code (`participant_code`) whose key is held
  separately and access-controlled.
- **De-identification:** Removing direct and indirect identifiers so a person cannot reasonably be
  identified.
- **MFA:** Multi-factor authentication.
- **Least privilege:** Granting the minimum access necessary to perform a role.
