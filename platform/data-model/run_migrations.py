"""
Data-model container entrypoint.
1. Runs Alembic migrations (create/update all tables)
2. Seeds demo data if the database is empty
"""
import os
import sys
import time
from datetime import datetime, date, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://agent:agent_secret@db:5432/patient_agent",
)


def wait_for_db(url: str, retries: int = 30, delay: float = 2.0):
    engine = create_engine(url)
    for attempt in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[data-model] Database is ready.")
            return engine
        except Exception:
            print(f"[data-model] Waiting for database... ({attempt + 1}/{retries})")
            time.sleep(delay)
    print("[data-model] Could not connect to database. Exiting.")
    sys.exit(1)


def run_alembic_upgrade():
    """Run alembic upgrade head — or just create_all if no migrations yet."""
    from models import Base
    engine = create_engine(DATABASE_URL)
    print("[data-model] Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("[data-model] Tables created/verified.")
    return engine


def seed_data(engine):
    from models import (
        Patient, Organization, ClinicalNote, Diagnosis, Medication,
        Allergy, LabResult, Encounter, NoteStatus, AllergySeverity,
        EhrVendor,
    )

    Session = sessionmaker(bind=engine)
    session = Session()

    if session.query(Patient).first():
        print("[data-model] Data already seeded. Skipping.")
        session.close()
        return

    print("[data-model] Seeding demo data...")

    # Organizations (with SMART on FHIR client credentials + vendor config)
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
    session.add_all(orgs)
    session.flush()

    # Patient
    patient = Patient(
        first_name="Sarah",
        last_name="Johnson",
        date_of_birth=date(1985, 3, 15),
        gender="female",
        email="sarah.johnson@email.com",
        phone="555-0142",
        address="123 Oak Street, Portland, OR 97201",
    )
    session.add(patient)
    session.flush()

    # Clinical Notes
    notes = [
        ClinicalNote(
            patient_id=patient.id,
            author="Dr. Emily Chen — Cardiology",
            content=(
                "Patient presents with well-controlled hypertension. Blood pressure "
                "today 128/82 mmHg. Currently on Lisinopril 10mg daily with good "
                "tolerance. Recommend continuing current regimen. Follow-up in 3 months "
                "with repeat labs including BMP and lipid panel."
            ),
            status=NoteStatus.pending_review,
        ),
        ClinicalNote(
            patient_id=patient.id,
            author="Dr. James Park — Primary Care",
            content=(
                "Annual wellness visit. Patient reports feeling well overall. Seasonal "
                "allergies managed with OTC antihistamines. Updated immunizations. "
                "Discussed importance of regular exercise and Mediterranean diet for "
                "cardiovascular health. BMI 24.2 — within normal range."
            ),
            status=NoteStatus.pending_review,
        ),
    ]
    session.add_all(notes)

    # Diagnoses
    diagnoses = [
        Diagnosis(patient_id=patient.id, code="I10", description="Essential hypertension", date_diagnosed=date(2020, 6, 15), status="active"),
        Diagnosis(patient_id=patient.id, code="E78.5", description="Hyperlipidemia, unspecified", date_diagnosed=date(2021, 1, 10), status="active"),
        Diagnosis(patient_id=patient.id, code="J30.1", description="Allergic rhinitis due to pollen", date_diagnosed=date(2018, 4, 20), status="active"),
    ]
    session.add_all(diagnoses)

    # Medications
    medications = [
        Medication(patient_id=patient.id, name="Lisinopril", dosage="10mg", frequency="Once daily", prescriber="Dr. Emily Chen", start_date=date(2020, 6, 15)),
        Medication(patient_id=patient.id, name="Atorvastatin", dosage="20mg", frequency="Once daily at bedtime", prescriber="Dr. Emily Chen", start_date=date(2021, 1, 15)),
        Medication(patient_id=patient.id, name="Cetirizine", dosage="10mg", frequency="As needed", prescriber="Dr. James Park", start_date=date(2018, 4, 20)),
    ]
    session.add_all(medications)

    # Allergies
    allergies = [
        Allergy(patient_id=patient.id, allergen="Penicillin", reaction="Hives, mild angioedema", severity=AllergySeverity.moderate),
        Allergy(patient_id=patient.id, allergen="Shellfish", reaction="Throat swelling, anaphylaxis risk", severity=AllergySeverity.severe),
        Allergy(patient_id=patient.id, allergen="Latex", reaction="Contact dermatitis", severity=AllergySeverity.mild),
    ]
    session.add_all(allergies)

    # Lab Results
    lab_results = [
        LabResult(patient_id=patient.id, test_name="Total Cholesterol", value="210", unit="mg/dL", reference_range="<200 mg/dL", date=datetime(2024, 11, 1)),
        LabResult(patient_id=patient.id, test_name="LDL Cholesterol", value="130", unit="mg/dL", reference_range="<100 mg/dL", date=datetime(2024, 11, 1)),
        LabResult(patient_id=patient.id, test_name="HDL Cholesterol", value="55", unit="mg/dL", reference_range=">40 mg/dL", date=datetime(2024, 11, 1)),
        LabResult(patient_id=patient.id, test_name="HbA1c", value="5.4", unit="%", reference_range="<5.7%", date=datetime(2024, 11, 1)),
        LabResult(patient_id=patient.id, test_name="Creatinine", value="0.9", unit="mg/dL", reference_range="0.6-1.2 mg/dL", date=datetime(2024, 11, 1)),
        LabResult(patient_id=patient.id, test_name="TSH", value="2.1", unit="mIU/L", reference_range="0.4-4.0 mIU/L", date=datetime(2024, 11, 1)),
    ]
    session.add_all(lab_results)

    # Encounters
    encounters = [
        Encounter(
            patient_id=patient.id,
            date=datetime(2024, 11, 15, 10, 30),
            provider="Dr. Emily Chen",
            location="Metro General Hospital — Cardiology",
            type="office_visit",
            summary="Follow-up for hypertension management. BP well-controlled on current regimen.",
        ),
        Encounter(
            patient_id=patient.id,
            date=datetime(2024, 10, 1, 9, 0),
            provider="Dr. James Park",
            location="Metro General Hospital — Primary Care",
            type="annual_wellness",
            summary="Annual wellness exam. All screenings up to date. Reviewed medications and allergies.",
        ),
    ]
    session.add_all(encounters)

    session.commit()
    session.close()
    print("[data-model] Demo data seeded successfully.")


if __name__ == "__main__":
    engine = wait_for_db(DATABASE_URL)
    engine = run_alembic_upgrade()
    seed_data(engine)
    print("[data-model] Complete. Exiting.")
