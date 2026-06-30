"""
Order Workflow API — the MVP mediator loop.

Order → Patient Review/Approve → Fulfillment Task → Status back to staff

Enforces the state machine defined in models.ORDER_TRANSITIONS.
Logs every transition to AccessLog for full audit trail.
Creates notification on AWAITING_PATIENT transition.
Runs stub prior-auth prediction on order creation.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    OrderDraft, OrderDraftStatus, OrderType, ORDER_TRANSITIONS,
    PatientAction, PatientActionType, PriorAuthLikelihood,
    AccessLog, Notification, Patient, Organization,
)
from app.schemas import (
    OrderDraftCreate, OrderDraftUpdate, OrderDraftOut,
    PatientActionCreate, PatientActionOut, OrderStatusTransition,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


# ── Prior Auth Prediction Stub ──

# Rule-based: drug classes likely to require PA
PA_LIKELY_DRUG_CLASSES = {
    "biologic", "specialty", "oncology", "immunosuppressant",
    "growth_hormone", "gene_therapy", "antipsychotic_atypical",
}

PA_LIKELY_PAYER_COMBOS = {
    ("commercial", "biologic"),
    ("commercial", "specialty"),
    ("medicare", "oncology"),
}


def predict_prior_auth(order: OrderDraft) -> PriorAuthLikelihood:
    """
    Stub PA prediction based on drug_class + payer_type.
    In production: train on historical patterns or payer rule datasets.
    """
    drug_class = (order.drug_class or "").lower().strip()
    payer = (order.payer_type or "").lower().strip()

    if drug_class in PA_LIKELY_DRUG_CLASSES:
        return PriorAuthLikelihood.yes
    if (payer, drug_class) in PA_LIKELY_PAYER_COMBOS:
        return PriorAuthLikelihood.yes
    if order.order_type == OrderType.prior_auth:
        return PriorAuthLikelihood.yes
    if drug_class and payer:
        return PriorAuthLikelihood.no
    return PriorAuthLikelihood.unknown


# ── Helpers ──

def _log_transition(db: Session, order: OrderDraft, action: str, details: str = ""):
    """Append an audit log entry for every state transition."""
    log = AccessLog(
        patient_id=order.patient_id,
        requesting_org_id=order.organization_id,
        action=action,
        timestamp=datetime.utcnow(),
        details=details or f"Order #{order.id} '{order.title}' → {order.status.value}",
    )
    db.add(log)


def _validate_transition(current: OrderDraftStatus, target: OrderDraftStatus):
    """Enforce the state machine — raise 409 on invalid transition."""
    allowed = ORDER_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition: {current.value} → {target.value}. "
                   f"Allowed: {[s.value for s in allowed]}",
        )


def _notify_patient(db: Session, order: OrderDraft, message: str):
    """Create an in-app notification for the patient."""
    notif = Notification(
        patient_id=order.patient_id,
        type="order_awaiting_approval",
        message=message,
    )
    db.add(notif)


# ── Staff endpoints ──

@router.post("", response_model=OrderDraftOut)
def create_order_draft(body: OrderDraftCreate, db: Session = Depends(get_db)):
    """Staff creates a draft order. Runs PA prediction stub."""
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    org = db.query(Organization).filter(Organization.id == body.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    order = OrderDraft(**body.model_dump())
    order.prior_auth_likely = predict_prior_auth(order)

    db.add(order)
    db.flush()

    _log_transition(db, order, "order_created",
                    f"Order #{order.id} '{order.title}' created by {order.created_by or 'staff'} "
                    f"(PA likely: {order.prior_auth_likely.value})")
    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=list[OrderDraftOut])
def list_orders(
    patient_id: int | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    status: OrderDraftStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """List orders with optional filters. Staff work queue uses this."""
    q = db.query(OrderDraft).options(
        joinedload(OrderDraft.actions),
        joinedload(OrderDraft.organization),
    )
    if patient_id:
        q = q.filter(OrderDraft.patient_id == patient_id)
    if organization_id:
        q = q.filter(OrderDraft.organization_id == organization_id)
    if status:
        q = q.filter(OrderDraft.status == status)
    return q.order_by(OrderDraft.updated_at.desc()).all()


@router.get("/queue", response_model=list[OrderDraftOut])
def staff_work_queue(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Staff work queue: grouped by status buckets.
    Returns all non-terminal orders (not fulfilled/cancelled).
    """
    terminal = [OrderDraftStatus.fulfilled, OrderDraftStatus.cancelled]
    q = db.query(OrderDraft).options(
        joinedload(OrderDraft.actions),
        joinedload(OrderDraft.organization),
    ).filter(~OrderDraft.status.in_(terminal))
    if organization_id:
        q = q.filter(OrderDraft.organization_id == organization_id)
    return q.order_by(OrderDraft.updated_at.desc()).all()


@router.get("/{order_id}", response_model=OrderDraftOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get a single order with its action history."""
    order = db.query(OrderDraft).options(
        joinedload(OrderDraft.actions),
        joinedload(OrderDraft.organization),
    ).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}", response_model=OrderDraftOut)
def update_order_draft(order_id: int, body: OrderDraftUpdate, db: Session = Depends(get_db)):
    """Staff edits a draft order (only while in DRAFTED or PATIENT_REQUESTED_CHANGE)."""
    order = db.query(OrderDraft).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderDraftStatus.drafted, OrderDraftStatus.patient_requested_change):
        raise HTTPException(status_code=409, detail=f"Cannot edit order in {order.status.value} state")

    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(order, field, val)

    # Re-run PA prediction if drug info changed
    order.prior_auth_likely = predict_prior_auth(order)
    order.updated_at = datetime.utcnow()

    _log_transition(db, order, "order_updated", f"Order #{order.id} updated by staff")
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/send-to-patient", response_model=OrderDraftOut)
def send_to_patient(order_id: int, db: Session = Depends(get_db)):
    """Staff sends draft to patient for review. DRAFTED → AWAITING_PATIENT."""
    order = db.query(OrderDraft).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _validate_transition(order.status, OrderDraftStatus.awaiting_patient)
    order.status = OrderDraftStatus.awaiting_patient
    order.updated_at = datetime.utcnow()

    _log_transition(db, order, "order_sent_to_patient")

    # Notification to patient
    patient = db.query(Patient).filter(Patient.id == order.patient_id).first()
    _notify_patient(
        db, order,
        f"New order for your review: {order.title} "
        f"from {order.organization.name if order.organization else 'your clinic'}",
    )

    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/transition", response_model=OrderDraftOut)
def transition_order(order_id: int, body: OrderStatusTransition, db: Session = Depends(get_db)):
    """
    Generic state transition endpoint (for staff-side moves like
    PATIENT_APPROVED → READY_TO_SUBMIT → SUBMITTED → FULFILLED).
    """
    order = db.query(OrderDraft).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _validate_transition(order.status, body.new_status)
    old_status = order.status.value
    order.status = body.new_status
    order.updated_at = datetime.utcnow()

    if body.new_status == OrderDraftStatus.submitted:
        order.submitted_at = datetime.utcnow()
    elif body.new_status == OrderDraftStatus.fulfilled:
        order.fulfilled_at = datetime.utcnow()

    _log_transition(db, order, "order_transition",
                    f"Order #{order.id} {old_status} → {body.new_status.value}")
    db.commit()
    db.refresh(order)
    return order


# ── Patient endpoints ──

@router.get("/patient/{patient_id}/pending", response_model=list[OrderDraftOut])
def patient_pending_orders(patient_id: int, db: Session = Depends(get_db)):
    """Patient sees orders awaiting their action."""
    return (
        db.query(OrderDraft)
        .options(joinedload(OrderDraft.actions), joinedload(OrderDraft.organization))
        .filter(
            OrderDraft.patient_id == patient_id,
            OrderDraft.status == OrderDraftStatus.awaiting_patient,
        )
        .order_by(OrderDraft.updated_at.desc())
        .all()
    )


@router.get("/patient/{patient_id}/all", response_model=list[OrderDraftOut])
def patient_all_orders(patient_id: int, db: Session = Depends(get_db)):
    """Patient sees all their orders (any status)."""
    return (
        db.query(OrderDraft)
        .options(joinedload(OrderDraft.actions), joinedload(OrderDraft.organization))
        .filter(OrderDraft.patient_id == patient_id)
        .order_by(OrderDraft.updated_at.desc())
        .all()
    )


@router.post("/{order_id}/patient-action", response_model=OrderDraftOut)
def patient_action(
    order_id: int, body: PatientActionCreate, db: Session = Depends(get_db),
):
    """
    Patient approves, approves with limits, requests change, or rejects.
    This is the "secret sauce" — structured constraints stored with the order.
    """
    order = db.query(OrderDraft).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderDraftStatus.awaiting_patient:
        raise HTTPException(
            status_code=409,
            detail=f"Order is not awaiting patient action (current: {order.status.value})",
        )

    # Create the immutable action record
    action = PatientAction(
        order_draft_id=order.id,
        patient_id=order.patient_id,
        **body.model_dump(),
    )
    db.add(action)

    # Transition the order based on action type
    if body.action_type in (PatientActionType.approve, PatientActionType.approve_with_limits):
        order.status = OrderDraftStatus.patient_approved

        # Store structured constraints on the order
        constraints = {}
        if body.allow_generic_substitution is not None:
            constraints["allow_generic_substitution"] = body.allow_generic_substitution
        if body.max_out_of_pocket is not None:
            constraints["max_out_of_pocket"] = body.max_out_of_pocket
        if body.preferred_pharmacy_id is not None:
            constraints["preferred_pharmacy_id"] = body.preferred_pharmacy_id
            order.destination_pharmacy_id = body.preferred_pharmacy_id
        if body.preferred_lab_id is not None:
            constraints["preferred_lab_id"] = body.preferred_lab_id
            order.destination_lab_id = body.preferred_lab_id
        if body.require_callback_before_changes:
            constraints["require_callback_before_changes"] = True
        if body.additional_constraints:
            constraints["additional"] = body.additional_constraints
        if constraints:
            order.patient_constraints = constraints

        _log_transition(db, order, "patient_approved",
                        f"Patient approved order #{order.id} "
                        f"(type: {body.action_type.value}, constraints: {constraints or 'none'})")

    elif body.action_type == PatientActionType.request_change:
        order.status = OrderDraftStatus.patient_requested_change
        _log_transition(db, order, "patient_requested_change",
                        f"Patient requested changes on order #{order.id}: {body.comment or 'no comment'}")

    elif body.action_type == PatientActionType.reject:
        order.status = OrderDraftStatus.cancelled
        _log_transition(db, order, "patient_rejected",
                        f"Patient rejected order #{order.id}: {body.comment or 'no comment'}")

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


# ── Audit timeline ──

@router.get("/{order_id}/timeline")
def order_timeline(order_id: int, db: Session = Depends(get_db)):
    """
    Full audit timeline for an order — every transition, patient action,
    and status change with timestamps.
    """
    order = db.query(OrderDraft).filter(OrderDraft.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    logs = (
        db.query(AccessLog)
        .filter(
            AccessLog.patient_id == order.patient_id,
            AccessLog.details.contains(f"Order #{order.id}"),
        )
        .order_by(AccessLog.timestamp.asc())
        .all()
    )

    return {
        "order_id": order.id,
        "current_status": order.status.value,
        "timeline": [
            {
                "timestamp": log.timestamp.isoformat(),
                "action": log.action,
                "details": log.details,
            }
            for log in logs
        ],
    }
