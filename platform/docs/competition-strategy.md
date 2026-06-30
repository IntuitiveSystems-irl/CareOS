# CareOS — Competition Strategy

> Internal reference. Do not submit. Last updated: June 2026.

---

## What the judges reward (from winner analysis)

The SMART App Gallery competition does **not** reward technical complexity.

It rewards:
1. A clearly defined, immediately recognizable healthcare problem
2. A specific, named user (not "healthcare stakeholders")
3. A measurable workflow improvement
4. Elegant — not exhaustive — use of FHIR
5. Likelihood of real-world adoption

**The emotional test:** Does the reviewer think *"I wish this existed in my hospital"*?

---

## What last year's winners did

| Winner | One-line problem | Specific user | FHIR role |
|---|---|---|---|
| **Primary Record** (1st) | Families can't coordinate discharge records | Family caregivers at home | Data source (Patient Access APIs) |
| **Nourishing Innovations** (2nd) | Dietitians document nutrition differently every time | Dietitians | Standardization medium |
| **PAIGE** (3rd) | Patients send incomplete portal messages | Physicians drowning in inbox | SMART-on-FHIR integration |

**None of them tried to transform healthcare. They transformed one workflow.**

---

## CareOS's current framing problem

The submission currently lists 18+ capabilities across 6 domains. To a judge with 8 minutes, that reads as:

> "This is ambitious and impressive and I have no idea what it actually does for me."

CareOS's technical depth is real. But infrastructure is hard to love in 8 minutes. The winning move is to make it feel as simple and immediately valuable as the best products from last year — while the architecture quietly demonstrates the platform depth.

---

## The strategic reframe

**Don't lead with the platform. Lead with the patient.**

### The one story to tell:

> Maria is a front-desk coordinator at a community clinic. Every morning she processes 30 new patient intakes — faxes, portal exports from three different EHRs, hand-written forms. She re-enters the same information into their system. It takes 4 hours. If she misses an allergy or an active medication, a clinician might not catch it.
>
> CareOS connects to their EHRs directly — FHIR R4 from Epic, HL7 v2 from the local lab — and assembles a single, complete, tamper-audited patient record before Maria arrives. She spends 20 minutes reviewing exceptions, not re-entering data.
>
> That's 47 minutes saved per shift. Per coordinator. Every day.

Everything else — SMART Backend Services, hash-chained audit, Bulk Data export, CDS Hooks, Patient Fishbowl™ — becomes **evidence** supporting this story.

---

## Reframing each capability as a human benefit

| Technical capability | What to say instead |
|---|---|
| HL7 v2 MLLP ingest | "Works with every hospital, even those still running 1990s messaging" |
| FHIR R4 canonical store | "One complete patient record, regardless of how many EHRs they've visited" |
| SMART Backend Services | "Connects to Epic and Cerner without anyone configuring a single setting on the hospital side" |
| Hash-chained audit | "Every time a record is touched, it's recorded in a way that can't be quietly edited — ever" |
| Patient Fishbowl™ | "Patients see where their care stands in real time. They stop calling the front desk." |
| CDS Hooks | "Clinical alerts appear inside the EHR at the moment the clinician needs them" |
| Bulk Data / USCDI v3 | "Patients carry their complete record to any new provider, in a format any modern EHR can read" |
| Research network | "De-identified data, with patient consent, funds clinic revenue and advances research" |

---

## The 8-minute presentation structure (if applicable)

```
0:00 – 1:00  The problem (Maria's morning. Numbers: 30 intakes, 4 hours, 1 missed allergy.)
1:00 – 2:00  The solution in one sentence. Live demo: check-in → relay → single record.
2:00 – 4:00  Patient Fishbowl™ demo. Patient sees their care status in real time.
4:00 – 5:30  How FHIR makes this possible. (One slide: HL7 v2 + FHIR R4 + SMART = one relay)
5:30 – 6:30  Evidence: 0.174ms transform, 59/59 invariants, 36/36 audit chain verified, live at launchflow.tech
6:30 – 7:30  Platform depth: this is infrastructure. One clinic today. Health system tomorrow.
7:30 – 8:00  Call to action: "I wish this existed in my hospital." → launchflow.tech
```

---

## What makes CareOS categorically different

Last year's winners built excellent **applications**.

CareOS is closer to **platform infrastructure** — the way Docker underpins containers or Stripe underpins payments. It isn't just one workflow app; it's the foundation that multiple patient-facing and clinician-facing applications are built on.

That distinction is powerful but creates a communication risk. The winning move:

> **"Solving one painful interoperability problem today, with an architecture that scales to many more."**

Lead with the one problem. Let the architecture speak for itself in the Q&A.

---

## The single headline to use everywhere

> **Every patient deserves one complete, portable health record. CareOS builds it.**

Variations:
- *"CareOS gives every patient one record — connected to every EHR they've ever used."*
- *"The operating system for patient-controlled health data."*
- *"Where FHIR becomes a front-desk superpower."*

---

## Checklist before submission

- [ ] Abstract opens with the patient/clinic problem — not the tech stack
- [ ] "Rationale" section names a specific user (front-desk coordinator, patient) in paragraph 1
- [ ] "Design" section shows FHIR as elegant and purposeful — not exhaustive
- [ ] Twitter summary passes the "I wish this existed" test
- [ ] Live demo URLs are verified working the morning of submission
- [ ] Logo + promotional photo uploaded (careos-logo.png + launchflow.tech screenshot)
- [ ] Character counts verified on all bounded fields
- [ ] Team member names filled in
