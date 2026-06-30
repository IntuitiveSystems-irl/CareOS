"""Seed the database with demo data for the prototype."""

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models import (
    Organization, Patient, ClinicalNote, Diagnosis, Medication,
    Allergy, LabResult, Encounter, NoteStatus, AllergySeverity,
    AccessRequest, AccessRequestStatus, Notification, AccessLog,
    UseType, SecondaryPurpose, EhrVendor,
    Destination, DestinationKind, FulfillmentPacket, FulfillmentTask,
    FulfillmentPreferences, FulfillmentPacketStatus, FulfillmentTaskType,
    FulfillmentTaskDestType, FulfillmentTaskStatus,
    OrderDraft, OrderDraftStatus, OrderType, PriorAuthLikelihood,
    Clinician, ClinicianRole, ClinicianStatus,
)


_LIVE_FHIR_URLS = {
    EhrVendor.epic: {
        "fhir_base_url": "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
        "redirect_uri": "https://launchflow.tech/callback",
    },
    EhrVendor.cerner: {
        "fhir_base_url": "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
        "redirect_uri": "https://launchflow.tech/callback",
    },
    EhrVendor.meditech: {
        "fhir_base_url": "https://fhir.meditech.com/explorer/api",
        "redirect_uri": "https://launchflow.tech/callback",
    },
}


def _update_org_fhir_urls(db: Session):
    """Patch existing org records with real vendor sandbox FHIR base URLs."""
    orgs = db.query(Organization).all()
    changed = False
    for org in orgs:
        if org.ehr_vendor and org.ehr_vendor in _LIVE_FHIR_URLS:
            updates = _LIVE_FHIR_URLS[org.ehr_vendor]
            if org.fhir_base_url != updates["fhir_base_url"]:
                org.fhir_base_url = updates["fhir_base_url"]
                org.redirect_uri = updates["redirect_uri"]
                changed = True
    if changed:
        db.commit()


def _ensure_sandbox_org(db: Session):
    """Idempotently ensure an OPEN SMART reference server exists.

    ``r4.smarthealthit.org`` is the SMART Health IT reference FHIR R4 server —
    open (no auth) so it gives a reliable, end-to-end "verified live pull" for
    the plug-and-play onboarding flow.
    """
    existing = (
        db.query(Organization)
        .filter(Organization.name == "SMART Health IT Sandbox")
        .first()
    )
    if existing:
        return
    db.add(Organization(
        name="SMART Health IT Sandbox",
        type="Reference Server",
        contact_email="support@smarthealthit.org",
        ehr_system_name="SMART Health IT (HAPI R4)",
        client_id="careos-sandbox-client",
        redirect_uri=None,
        fhir_base_url="https://r4.smarthealthit.org",
        ehr_vendor=EhrVendor.other,
        smart_discovery_mode="capability_statement",
        fhir_profile="r4",
    ))
    db.commit()


def _ensure_demo_clinicians(db: Session):
    """Idempotently seed demo clinicians so the staff registry + login work."""
    from app.routers.clinicians import hash_password

    if db.query(Clinician).first():
        return

    org = db.query(Organization).filter(Organization.name == "Metro General Hospital").first()
    riverside = db.query(Organization).filter(Organization.name == "Riverside Family Medicine").first()
    org_id = org.id if org else None

    demo = [
        Clinician(
            first_name="Evelyn", last_name="Chen", email="dr.chen@metrogeneral.com",
            npi="1234567890", credential="MD", specialty="Internal Medicine",
            role=ClinicianRole.physician, status=ClinicianStatus.active,
            organization_id=org_id, password_hash=hash_password("clinician123"),
        ),
        Clinician(
            first_name="Marcus", last_name="Reed", email="m.reed@metrogeneral.com",
            npi="2345678901", credential="RN", specialty="Care Coordination",
            role=ClinicianRole.nurse, status=ClinicianStatus.active,
            organization_id=org_id, password_hash=hash_password("clinician123"),
        ),
        Clinician(
            first_name="Priya", last_name="Nair", email="p.nair@riversidefm.com",
            npi="3456789012", credential="NP", specialty="Family Medicine",
            role=ClinicianRole.physician_assistant, status=ClinicianStatus.active,
            organization_id=riverside.id if riverside else None,
            password_hash=hash_password("clinician123"),
        ),
    ]
    db.add_all(demo)
    db.commit()


def _ensure_demo_feedback(db: Session):
    """Idempotently seed patient feedback so CDS cards show the patient's voice."""
    from app.models import PatientFeedback, FeedbackSentiment

    if db.query(PatientFeedback).first():
        return
    patient = db.query(Patient).first()
    if not patient:
        return

    med = db.query(Medication).filter(Medication.patient_id == patient.id).first()
    items = []
    if med:
        items.append(PatientFeedback(
            patient_id=patient.id, topic="medication",
            target_kind="medication", target_ref=f"m{med.id}", target_label=med.name,
            sentiment=FeedbackSentiment.preference,
            message=f"I'd prefer the generic version of {med.name} if possible — cost is a real concern for me.",
        ))
        items.append(PatientFeedback(
            patient_id=patient.id, topic="medication",
            target_kind="medication", target_ref=f"m{med.id}", target_label=med.name,
            sentiment=FeedbackSentiment.concern,
            message=f"{med.name} seemed to make me lightheaded in the mornings last week.",
        ))
    items.append(PatientFeedback(
        patient_id=patient.id, topic="general",
        sentiment=FeedbackSentiment.question,
        message="Could we review at my next visit whether I still need all of my current medications?",
    ))
    db.add_all(items)
    db.commit()


def seed_database(db: Session):
    if db.query(Patient).first():
        # data-model container already seeded core data — just add orders if missing
        _seed_orders_if_needed(db)
        _update_org_fhir_urls(db)
        _ensure_sandbox_org(db)
        _ensure_demo_clinicians(db)
        _ensure_demo_feedback(db)
        return

    # ── Organizations (with SMART on FHIR client credentials) ──
    orgs = [
        Organization(
            name="Metro General Hospital",
            type="Hospital",
            contact_email="records@metrogeneral.example.com",
            ehr_system_name="Epic",
            client_id="metro-general-client-001",
            client_secret="mg-secret-abc123",
            redirect_uri="https://launchflow.tech/callback",
            fhir_base_url="https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
            ehr_vendor=EhrVendor.epic,
            smart_discovery_mode="smart_config",
            fhir_profile="r4",
        ),
        Organization(
            name="Riverside Family Medicine",
            type="Clinic",
            contact_email="admin@riversidefm.example.com",
            ehr_system_name="Cerner Millennium",
            client_id="riverside-fm-client-002",
            client_secret="rf-secret-def456",
            redirect_uri="https://launchflow.tech/callback",
            fhir_base_url="https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
            ehr_vendor=EhrVendor.cerner,
            smart_discovery_mode="smart_config",
            fhir_profile="r4",
        ),
        Organization(
            name="Pacific Specialty Group",
            type="Specialty Practice",
            contact_email="info@pacificspecialty.example.com",
            ehr_system_name="MEDITECH Expanse",
            client_id="pacific-spec-client-003",
            client_secret="ps-secret-ghi789",
            redirect_uri="https://launchflow.tech/callback",
            fhir_base_url="https://fhir.meditech.com/explorer/api",
            ehr_vendor=EhrVendor.meditech,
            smart_discovery_mode="capability_statement",
            fhir_profile="us_core_stu7",
        ),
    ]
    db.add_all(orgs)
    db.flush()
    _ensure_sandbox_org(db)
    _ensure_demo_clinicians(db)

    # ── Patient ──
    patient = Patient(
        first_name="Alex",
        last_name="Morgan",
        date_of_birth=date(1985, 6, 15),
        gender="male",
        email="alex.morgan@example.com",
        phone="(555) 234-5678",
        address="1234 Elm Street, Seattle, WA 98101",
    )
    db.add(patient)
    db.flush()

    # ── Diagnoses ──
    diagnoses = [
        Diagnosis(
            patient_id=patient.id,
            code="E11.9",
            description="Type 2 diabetes mellitus without complications",
            date_diagnosed=date(2020, 3, 12),
            status="active",
        ),
        Diagnosis(
            patient_id=patient.id,
            code="I10",
            description="Essential (primary) hypertension",
            date_diagnosed=date(2019, 8, 5),
            status="active",
        ),
        Diagnosis(
            patient_id=patient.id,
            code="J45.20",
            description="Mild intermittent asthma, uncomplicated",
            date_diagnosed=date(2015, 1, 20),
            status="active",
        ),
    ]
    db.add_all(diagnoses)

    # ── Medications ──
    medications = [
        Medication(
            patient_id=patient.id,
            name="Metformin",
            dosage="500 mg",
            frequency="Twice daily",
            prescriber="Dr. Sarah Chen",
            start_date=date(2020, 3, 15),
        ),
        Medication(
            patient_id=patient.id,
            name="Lisinopril",
            dosage="10 mg",
            frequency="Once daily",
            prescriber="Dr. Sarah Chen",
            start_date=date(2019, 8, 10),
        ),
        Medication(
            patient_id=patient.id,
            name="Albuterol Inhaler",
            dosage="90 mcg/actuation",
            frequency="As needed",
            prescriber="Dr. James Park",
            start_date=date(2015, 2, 1),
        ),
    ]
    db.add_all(medications)

    # ── Allergies ──
    allergies = [
        Allergy(
            patient_id=patient.id,
            allergen="Penicillin",
            reaction="Hives, skin rash",
            severity=AllergySeverity.moderate,
        ),
        Allergy(
            patient_id=patient.id,
            allergen="Sulfa drugs",
            reaction="Difficulty breathing",
            severity=AllergySeverity.severe,
        ),
        Allergy(
            patient_id=patient.id,
            allergen="Latex",
            reaction="Contact dermatitis",
            severity=AllergySeverity.mild,
        ),
    ]
    db.add_all(allergies)

    # ── Lab Results ──
    lab_results = [
        LabResult(
            patient_id=patient.id,
            test_name="HbA1c",
            value="7.2",
            unit="%",
            reference_range="4.0-5.6%",
            date=datetime(2025, 12, 1, 9, 0),
            status="final",
        ),
        LabResult(
            patient_id=patient.id,
            test_name="Fasting Glucose",
            value="142",
            unit="mg/dL",
            reference_range="70-100 mg/dL",
            date=datetime(2025, 12, 1, 9, 0),
            status="final",
        ),
        LabResult(
            patient_id=patient.id,
            test_name="Total Cholesterol",
            value="210",
            unit="mg/dL",
            reference_range="<200 mg/dL",
            date=datetime(2025, 11, 15, 8, 30),
            status="final",
        ),
        LabResult(
            patient_id=patient.id,
            test_name="Serum Creatinine",
            value="1.0",
            unit="mg/dL",
            reference_range="0.7-1.3 mg/dL",
            date=datetime(2025, 12, 1, 9, 0),
            status="final",
        ),
        LabResult(
            patient_id=patient.id,
            test_name="Blood Pressure (systolic)",
            value="138",
            unit="mmHg",
            reference_range="<120 mmHg",
            date=datetime(2026, 1, 10, 14, 0),
            status="final",
        ),
    ]
    db.add_all(lab_results)

    # ── Encounters ──
    encounters = [
        Encounter(
            patient_id=patient.id,
            date=datetime(2026, 1, 10, 14, 0),
            provider="Dr. Sarah Chen",
            location="Metro General Hospital — Internal Medicine",
            type="Follow-up",
            summary="Routine diabetes and hypertension follow-up. HbA1c slightly elevated. Discussed dietary changes and medication adherence.",
        ),
        Encounter(
            patient_id=patient.id,
            date=datetime(2025, 12, 1, 9, 0),
            provider="Dr. Sarah Chen",
            location="Metro General Hospital — Lab",
            type="Lab Visit",
            summary="Fasting blood work for diabetes management. HbA1c, glucose, cholesterol, creatinine panels ordered.",
        ),
        Encounter(
            patient_id=patient.id,
            date=datetime(2025, 9, 18, 10, 30),
            provider="Dr. James Park",
            location="Riverside Family Medicine",
            type="Annual Physical",
            summary="Annual wellness exam. Asthma well controlled. Renewed albuterol prescription. Referred to Metro General for diabetes labs.",
        ),
    ]
    db.add_all(encounters)

    # ── Clinical Notes ──
    notes = [
        ClinicalNote(
            patient_id=patient.id,
            author="Dr. Sarah Chen",
            date=datetime(2026, 1, 10, 15, 30),
            content=(
                "Patient presents for diabetes and hypertension follow-up. "
                "Reports occasional headaches, no chest pain or shortness of breath. "
                "HbA1c at 7.2%, slightly above target. Blood pressure 138/88. "
                "Discussed importance of low-sodium diet and regular exercise. "
                "Will continue current medications. Follow-up in 3 months with repeat labs."
            ),
            status=NoteStatus.pending_review,
        ),
        ClinicalNote(
            patient_id=patient.id,
            author="Dr. James Park",
            date=datetime(2025, 9, 18, 11, 45),
            content=(
                "Annual physical exam. Patient reports feeling well overall. "
                "Asthma has been well-controlled with PRN albuterol use approximately "
                "once per week. No nocturnal symptoms. Lung exam clear. "
                "Renewed albuterol inhaler. Recommended follow-up with Dr. Chen for "
                "diabetes management."
            ),
            status=NoteStatus.approved,
        ),
    ]
    db.add_all(notes)
    db.flush()

    # ── Demo Access Requests (primary + secondary) ──
    ar_primary = AccessRequest(
        patient_id=patient.id,
        requesting_org_id=orgs[1].id,  # Riverside Family Medicine
        purpose="Continuity of care — annual physical follow-up and medication reconciliation",
        status=AccessRequestStatus.pending,
        scopes="patient/*.read",
        use_type=UseType.primary_care,
    )
    ar_secondary = AccessRequest(
        patient_id=patient.id,
        requesting_org_id=orgs[2].id,  # Pacific Specialty Group
        purpose="Retrospective study on Type 2 diabetes outcomes in Pacific Northwest patients",
        status=AccessRequestStatus.pending,
        scopes="patient/Condition.read patient/Observation.read patient/MedicationRequest.read",
        use_type=UseType.secondary_use,
        secondary_purpose=SecondaryPurpose.research,
    )
    db.add_all([ar_primary, ar_secondary])
    db.flush()

    # Notifications for the demo requests
    db.add(Notification(
        patient_id=patient.id,
        type="access_request",
        message=f"{orgs[1].name} is requesting access to your health records for primary care. Purpose: {ar_primary.purpose}",
        access_request_id=ar_primary.id,
    ))
    db.add(Notification(
        patient_id=patient.id,
        type="access_request",
        message=f"{orgs[2].name} is requesting access to your health records for research (secondary use). Purpose: {ar_secondary.purpose}",
        access_request_id=ar_secondary.id,
    ))

    # Access logs
    db.add(AccessLog(
        patient_id=patient.id,
        requesting_org_id=orgs[1].id,
        action="access_requested",
        details=f"Primary care access request created by {orgs[1].name}",
    ))
    db.add(AccessLog(
        patient_id=patient.id,
        requesting_org_id=orgs[2].id,
        action="access_requested",
        details=f"Secondary use (research) access request created by {orgs[2].name}",
    ))

    # ── Destination Directory ──
    destinations = [
        Destination(
            name="LabCorp Northwest",
            kind=DestinationKind.lab,
            preferred_contact_method="api_stub",
            endpoint_url="https://labcorp-stub.example.com/orders",
            phone="(555) 100-2000",
            email="orders@labcorp-stub.example.com",
            address="500 Lab Way, Seattle, WA 98101",
        ),
        Destination(
            name="Quest Diagnostics Pacific",
            kind=DestinationKind.lab,
            preferred_contact_method="api_stub",
            endpoint_url="https://quest-stub.example.com/orders",
            phone="(555) 100-3000",
            email="orders@quest-stub.example.com",
            address="750 Diagnostic Blvd, Seattle, WA 98102",
        ),
        Destination(
            name="Walgreens Pharmacy #1284",
            kind=DestinationKind.pharmacy,
            preferred_contact_method="api_stub",
            endpoint_url="https://walgreens-stub.example.com/rx",
            phone="(555) 200-1000",
            email="rx1284@walgreens-stub.example.com",
            address="100 Main St, Seattle, WA 98101",
        ),
        Destination(
            name="CVS Pharmacy #8821",
            kind=DestinationKind.pharmacy,
            preferred_contact_method="api_stub",
            endpoint_url="https://cvs-stub.example.com/rx",
            phone="(555) 200-2000",
            email="rx8821@cvs-stub.example.com",
            address="200 Broadway, Seattle, WA 98102",
        ),
        Destination(
            name="Seattle Cardiology Associates",
            kind=DestinationKind.provider,
            preferred_contact_method="fax_stub",
            phone="(555) 300-1000",
            fax="(555) 300-1001",
            email="referrals@seattlecardio.example.com",
            address="900 Heart Lane, Seattle, WA 98103",
        ),
        Destination(
            name="Pacific Endocrinology Center",
            kind=DestinationKind.provider,
            preferred_contact_method="email_stub",
            phone="(555) 300-2000",
            email="referrals@pacificendo.example.com",
            address="1100 Endo Drive, Seattle, WA 98104",
        ),
        Destination(
            name="Blue Cross Blue Shield of WA",
            kind=DestinationKind.payer,
            preferred_contact_method="api_stub",
            endpoint_url="https://bcbs-stub.example.com/priorauth",
            phone="(555) 400-1000",
            email="priorauth@bcbs-stub.example.com",
            address="2000 Insurance Plaza, Seattle, WA 98105",
        ),
    ]
    db.add_all(destinations)
    db.flush()

    # ── Patient Fulfillment Preferences ──
    prefs = FulfillmentPreferences(
        patient_id=patient.id,
        preferred_lab_id=destinations[0].id,        # LabCorp Northwest
        preferred_pharmacy_id=destinations[2].id,    # Walgreens #1284
        preferred_primary_care_office_id=None,
        preferred_payer_id=destinations[6].id,       # BCBS of WA
        preferred_specialist_office_ids=[destinations[4].id, destinations[5].id],
    )
    db.add(prefs)
    db.flush()

    # ── Demo Fulfillment Packet (from first encounter + first note) ──
    packet = FulfillmentPacket(
        patient_id=patient.id,
        organization_id=orgs[0].id,
        encounter_id=encounters[0].id,
        source_note_id=notes[0].id,
        status=FulfillmentPacketStatus.created,
        items_json={
            "medications": [{"name": "Metformin", "dosage": "500 mg", "prescriber": "Dr. Sarah Chen"}],
            "lab_orders": [{"test_name": "HbA1c", "date": "2025-12-01", "status": "final"}],
            "diagnoses": [{"code": "E11.9", "description": "Type 2 diabetes mellitus"}],
            "note_summary": notes[0].content[:200],
        },
    )
    db.add(packet)
    db.flush()

    demo_tasks = [
        FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.lab_order,
            destination_type=FulfillmentTaskDestType.lab,
            destination_id=destinations[0].id,
            payload_json={"test_name": "HbA1c Follow-up", "all_orders": [{"test_name": "HbA1c"}]},
            status=FulfillmentTaskStatus.queued,
        ),
        FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.pharmacy_rx,
            destination_type=FulfillmentTaskDestType.pharmacy,
            destination_id=destinations[2].id,
            payload_json={"medication_name": "Metformin", "all_medications": [{"name": "Metformin", "dosage": "500 mg"}]},
            status=FulfillmentTaskStatus.queued,
        ),
        FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.referral,
            destination_type=FulfillmentTaskDestType.provider,
            destination_id=destinations[5].id,
            payload_json={"specialty": "endocrinology", "reason": "Elevated HbA1c — diabetes management"},
            status=FulfillmentTaskStatus.queued,
        ),
        FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.insurance_packet,
            destination_type=FulfillmentTaskDestType.payer,
            destination_id=destinations[6].id,
            payload_json={"procedure": "Endocrinology referral + HbA1c monitoring", "medications": ["Metformin"]},
            status=FulfillmentTaskStatus.queued,
        ),
    ]
    db.add_all(demo_tasks)

    # Also seed orders in the full-seed path
    _seed_orders_if_needed(db)

    db.commit()
    _ensure_demo_feedback(db)


def _seed_orders_if_needed(db: Session):
    """Seed demo orders independently — runs even when data-model already created core data."""
    if db.query(OrderDraft).first():
        return  # orders already exist

    patient = db.query(Patient).first()
    if not patient:
        return

    org1 = db.query(Organization).filter(Organization.name == "Metro General Hospital").first()
    org2 = db.query(Organization).filter(Organization.name == "Riverside Family Medicine").first()
    if not org1 or not org2:
        return

    demo_orders = [
        OrderDraft(
            patient_id=patient.id,
            organization_id=org1.id,
            order_type=OrderType.medication,
            status=OrderDraftStatus.awaiting_patient,
            title="Amlodipine 5mg daily",
            description="Adding calcium channel blocker for better BP control. Current Lisinopril alone not achieving target.",
            drug_name="Amlodipine",
            drug_dosage="5mg",
            drug_frequency="Once daily",
            drug_class="antihypertensive",
            icd_codes="I10",
            payer_type="commercial",
            prior_auth_likely=PriorAuthLikelihood.no,
            created_by="Dr. Emily Chen",
        ),
        OrderDraft(
            patient_id=patient.id,
            organization_id=org1.id,
            order_type=OrderType.lab_order,
            status=OrderDraftStatus.awaiting_patient,
            title="Comprehensive Metabolic Panel",
            description="Routine follow-up labs for hypertension and statin monitoring.",
            lab_test_code="24323-8",
            lab_test_name="Comprehensive metabolic 2000 panel",
            icd_codes="I10, E78.5",
            payer_type="commercial",
            prior_auth_likely=PriorAuthLikelihood.no,
            created_by="Dr. Emily Chen",
        ),
        OrderDraft(
            patient_id=patient.id,
            organization_id=org2.id,
            order_type=OrderType.medication,
            status=OrderDraftStatus.awaiting_patient,
            title="Humira 40mg injection biweekly",
            description="Initiating biologic therapy for newly diagnosed rheumatoid arthritis.",
            drug_name="Adalimumab (Humira)",
            drug_dosage="40mg",
            drug_frequency="Every 2 weeks",
            drug_class="biologic",
            icd_codes="M06.9",
            payer_type="commercial",
            prior_auth_likely=PriorAuthLikelihood.yes,
            created_by="Dr. Sarah Kim",
        ),
        OrderDraft(
            patient_id=patient.id,
            organization_id=org1.id,
            order_type=OrderType.referral,
            status=OrderDraftStatus.drafted,
            title="Cardiology referral — stress test",
            description="Patient reports occasional chest tightness with exertion. Recommend cardiac stress test.",
            icd_codes="R07.9, I10",
            payer_type="commercial",
            prior_auth_likely=PriorAuthLikelihood.unknown,
            created_by="Dr. James Park",
        ),
    ]
    db.add_all(demo_orders)
    db.flush()

    for order in demo_orders:
        db.add(AccessLog(
            patient_id=patient.id,
            requesting_org_id=order.organization_id,
            action="order_created",
            details=f"Order #{order.id} '{order.title}' created by {order.created_by} (PA likely: {order.prior_auth_likely.value})",
        ))
        if order.status == OrderDraftStatus.awaiting_patient:
            db.add(AccessLog(
                patient_id=patient.id,
                requesting_org_id=order.organization_id,
                action="order_sent_to_patient",
                details=f"Order #{order.id} '{order.title}' → awaiting_patient",
            ))
            db.add(Notification(
                patient_id=patient.id,
                type="order_awaiting_approval",
                message=f"New order for your review: {order.title}",
            ))

    db.commit()
