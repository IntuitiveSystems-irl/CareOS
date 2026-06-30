"""
Fulfillment Routing endpoints.

Handles creation of fulfillment packets from encounters/notes,
task queuing, sending via connectors, destination directory,
patient preferences, and clinician visibility.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    FulfillmentPacket, FulfillmentTask, FulfillmentPreferences,
    Destination, ClinicalNote, Encounter, Medication, Diagnosis,
    LabResult, Patient,
    FulfillmentPacketStatus, FulfillmentTaskType, FulfillmentTaskDestType,
    FulfillmentTaskStatus, DestinationKind,
)
from app.schemas import (
    FulfillmentPacketOut, FulfillmentPacketCreate, FulfillmentTaskOut,
    FulfillmentPreferencesOut, FulfillmentPreferencesUpdate, DestinationOut,
)
from app.connectors.router import route_task
from app.routers.websocket import manager as ws_manager

router = APIRouter(tags=["Fulfillment"])


# ── Destination Directory ──

@router.get("/api/destinations", response_model=list[DestinationOut])
def list_destinations(
    kind: Optional[DestinationKind] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Destination)
    if kind is not None:
        q = q.filter(Destination.kind == kind)
    return q.order_by(Destination.name).all()


# ── Patient Preferences ──

@router.get("/api/patient/{patient_id}/preferences", response_model=FulfillmentPreferencesOut)
def get_preferences(patient_id: int, db: Session = Depends(get_db)):
    prefs = db.query(FulfillmentPreferences).filter(
        FulfillmentPreferences.patient_id == patient_id
    ).first()
    if not prefs:
        raise HTTPException(404, "No preferences found for this patient")
    return prefs


@router.post("/api/patient/{patient_id}/preferences", response_model=FulfillmentPreferencesOut)
def update_preferences(
    patient_id: int,
    data: FulfillmentPreferencesUpdate,
    db: Session = Depends(get_db),
):
    prefs = db.query(FulfillmentPreferences).filter(
        FulfillmentPreferences.patient_id == patient_id
    ).first()
    if not prefs:
        prefs = FulfillmentPreferences(patient_id=patient_id)
        db.add(prefs)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(prefs, field, val)
    db.commit()
    db.refresh(prefs)
    return prefs


# ── Fulfillment Packets ──

def _build_items_json(patient_id: int, encounter_id: Optional[int], note_id: Optional[int], db: Session) -> dict:
    """Build a summary of orders/prescriptions/referrals from patient data."""
    items: dict = {"medications": [], "lab_orders": [], "diagnoses": [], "note_summary": None}

    meds = db.query(Medication).filter(Medication.patient_id == patient_id).all()
    items["medications"] = [{"name": m.name, "dosage": m.dosage, "prescriber": m.prescriber} for m in meds]

    labs = db.query(LabResult).filter(LabResult.patient_id == patient_id).all()
    items["lab_orders"] = [{"test_name": l.test_name, "date": str(l.date), "status": l.status} for l in labs]

    diags = db.query(Diagnosis).filter(Diagnosis.patient_id == patient_id).all()
    items["diagnoses"] = [{"code": d.code, "description": d.description} for d in diags]

    if note_id:
        note = db.query(ClinicalNote).get(note_id)
        if note:
            items["note_summary"] = note.content[:500]

    if encounter_id:
        enc = db.query(Encounter).get(encounter_id)
        if enc:
            items["encounter_summary"] = enc.summary

    return items


def _create_tasks_from_preferences(packet: FulfillmentPacket, prefs: Optional[FulfillmentPreferences], items: dict, db: Session):
    """Create fulfillment tasks based on patient preferences and available items."""
    tasks = []

    # Lab order task
    if items.get("lab_orders"):
        tasks.append(FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.lab_order,
            destination_type=FulfillmentTaskDestType.lab,
            destination_id=prefs.preferred_lab_id if prefs else None,
            payload_json={"test_name": items["lab_orders"][0]["test_name"], "all_orders": items["lab_orders"]},
            status=FulfillmentTaskStatus.queued,
        ))

    # Pharmacy routing task
    if items.get("medications"):
        tasks.append(FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.pharmacy_rx,
            destination_type=FulfillmentTaskDestType.pharmacy,
            destination_id=prefs.preferred_pharmacy_id if prefs else None,
            payload_json={"medication_name": items["medications"][0]["name"], "all_medications": items["medications"]},
            status=FulfillmentTaskStatus.queued,
        ))

    # Referral task (if diagnoses suggest specialist needed)
    if items.get("diagnoses"):
        specialist_ids = (prefs.preferred_specialist_office_ids or []) if prefs else []
        tasks.append(FulfillmentTask(
            packet_id=packet.id,
            type=FulfillmentTaskType.referral,
            destination_type=FulfillmentTaskDestType.provider,
            destination_id=specialist_ids[0] if specialist_ids else None,
            payload_json={"specialty": "specialist", "reason": items["diagnoses"][0]["description"]},
            status=FulfillmentTaskStatus.queued,
        ))

    # Insurance packet task
    tasks.append(FulfillmentTask(
        packet_id=packet.id,
        type=FulfillmentTaskType.insurance_packet,
        destination_type=FulfillmentTaskDestType.payer,
        destination_id=prefs.preferred_payer_id if prefs else None,
        payload_json={
            "procedure": items["diagnoses"][0]["description"] if items.get("diagnoses") else "general visit",
            "medications": [m["name"] for m in items.get("medications", [])],
        },
        status=FulfillmentTaskStatus.queued,
    ))

    for t in tasks:
        db.add(t)
    db.commit()
    return tasks


@router.post("/api/patient/{patient_id}/fulfillment/packets", response_model=FulfillmentPacketOut)
def create_packet(
    patient_id: int,
    data: FulfillmentPacketCreate,
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).get(patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    items = _build_items_json(patient_id, data.encounter_id, data.note_id, db)

    packet = FulfillmentPacket(
        patient_id=patient_id,
        organization_id=data.organization_id,
        encounter_id=data.encounter_id,
        source_note_id=data.note_id,
        status=FulfillmentPacketStatus.created,
        items_json=items,
    )
    db.add(packet)
    db.commit()
    db.refresh(packet)

    prefs = db.query(FulfillmentPreferences).filter(
        FulfillmentPreferences.patient_id == patient_id
    ).first()

    _create_tasks_from_preferences(packet, prefs, items, db)

    # Re-query with tasks loaded
    packet = (
        db.query(FulfillmentPacket)
        .options(joinedload(FulfillmentPacket.tasks).joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.id == packet.id)
        .first()
    )

    # Push WebSocket event
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(ws_manager.send_to_patient(patient_id, {
            "type": "fulfillment_packet_created",
            "message": f"Fulfillment packet #{packet.id} created with {len(packet.tasks)} tasks",
            "data": {"packet_id": packet.id, "task_count": len(packet.tasks)},
        }))
    except Exception:
        pass

    return packet


@router.get("/api/patient/{patient_id}/fulfillment/packets", response_model=list[FulfillmentPacketOut])
def list_packets(patient_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FulfillmentPacket)
        .options(joinedload(FulfillmentPacket.tasks).joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.patient_id == patient_id)
        .order_by(FulfillmentPacket.created_at.desc())
        .all()
    )


@router.get("/api/patient/{patient_id}/fulfillment/packets/{packet_id}", response_model=FulfillmentPacketOut)
def get_packet(patient_id: int, packet_id: int, db: Session = Depends(get_db)):
    packet = (
        db.query(FulfillmentPacket)
        .options(joinedload(FulfillmentPacket.tasks).joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.id == packet_id, FulfillmentPacket.patient_id == patient_id)
        .first()
    )
    if not packet:
        raise HTTPException(404, "Packet not found")
    return packet


@router.get("/api/patient/{patient_id}/fulfillment/tasks", response_model=list[FulfillmentTaskOut])
def list_tasks(
    patient_id: int,
    status: Optional[FulfillmentTaskStatus] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(FulfillmentTask)
        .join(FulfillmentPacket)
        .options(joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.patient_id == patient_id)
    )
    if status is not None:
        q = q.filter(FulfillmentTask.status == status)
    return q.order_by(FulfillmentTask.created_at.desc()).all()


# ── Send Tasks via Connectors ──

@router.post("/api/patient/{patient_id}/fulfillment/packets/{packet_id}/send", response_model=FulfillmentPacketOut)
def send_packet_tasks(patient_id: int, packet_id: int, db: Session = Depends(get_db)):
    packet = (
        db.query(FulfillmentPacket)
        .options(joinedload(FulfillmentPacket.tasks).joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.id == packet_id, FulfillmentPacket.patient_id == patient_id)
        .first()
    )
    if not packet:
        raise HTTPException(404, "Packet not found")

    any_failed = False
    for task in packet.tasks:
        if task.status != FulfillmentTaskStatus.queued:
            continue
        result = route_task(task)
        if result.success:
            task.status = FulfillmentTaskStatus(result.status)
        else:
            task.status = FulfillmentTaskStatus.failed
            task.last_error = result.message
            any_failed = True
        task.updated_at = datetime.utcnow()

    packet.status = FulfillmentPacketStatus.blocked if any_failed else FulfillmentPacketStatus.in_progress
    # Check if all tasks are already completed/sent
    all_done = all(t.status in (FulfillmentTaskStatus.completed, FulfillmentTaskStatus.acknowledged) for t in packet.tasks)
    if all_done:
        packet.status = FulfillmentPacketStatus.completed

    db.commit()
    db.refresh(packet)

    # Push WebSocket events for task updates
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(ws_manager.send_to_patient(patient_id, {
            "type": "fulfillment_task_updated",
            "message": f"Fulfillment packet #{packet.id} tasks sent via connectors",
            "data": {"packet_id": packet.id, "status": packet.status.value},
        }))
    except Exception:
        pass

    return packet


# ── Clinician View ──

@router.get("/api/clinician/patient/{patient_id}/fulfillment/packets", response_model=list[FulfillmentPacketOut])
def clinician_packets(patient_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FulfillmentPacket)
        .options(joinedload(FulfillmentPacket.tasks).joinedload(FulfillmentTask.destination))
        .filter(FulfillmentPacket.patient_id == patient_id)
        .order_by(FulfillmentPacket.created_at.desc())
        .all()
    )
