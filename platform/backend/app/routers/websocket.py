"""
WebSocket endpoint for real-time patient notifications.

Patients connect via WebSocket and receive push notifications when:
  - A new consent/access request arrives
  - An access request status changes
  - A payment is processed
  - FHIR data is retrieved by an organization
"""
import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter(tags=["WebSocket"])


# ── Connection Manager ──

class ConnectionManager:
    """Manages active WebSocket connections per patient."""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, patient_id: int, websocket: WebSocket):
        await websocket.accept()
        if patient_id not in self.active_connections:
            self.active_connections[patient_id] = []
        self.active_connections[patient_id].append(websocket)

    def disconnect(self, patient_id: int, websocket: WebSocket):
        if patient_id in self.active_connections:
            self.active_connections[patient_id] = [
                ws for ws in self.active_connections[patient_id] if ws != websocket
            ]
            if not self.active_connections[patient_id]:
                del self.active_connections[patient_id]

    async def send_to_patient(self, patient_id: int, message: dict):
        if patient_id in self.active_connections:
            dead = []
            for ws in self.active_connections[patient_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(patient_id, ws)

    async def broadcast(self, message: dict):
        for patient_id in list(self.active_connections.keys()):
            await self.send_to_patient(patient_id, message)


manager = ConnectionManager()


# ── WebSocket endpoint ──

@router.websocket("/ws/patient/{patient_id}")
async def patient_websocket(websocket: WebSocket, patient_id: int):
    """
    WebSocket connection for a patient.
    The frontend connects here to receive real-time push notifications.
    """
    await manager.connect(patient_id, websocket)
    try:
        while True:
            # Keep connection alive; client can send pings or messages
            data = await websocket.receive_text()
            # Echo back acknowledgment
            await websocket.send_json({"type": "ack", "received": data})
    except WebSocketDisconnect:
        manager.disconnect(patient_id, websocket)


# ── HTTP endpoint for internal services to push notifications ──

class WsNotifyRequest(BaseModel):
    patient_id: int
    type: str = "notification"
    message: str = ""
    session_id: int | None = None
    access_request_id: int | None = None
    use_type: str | None = None
    secondary_purpose: str | None = None
    data: dict | None = None


@router.post("/api/ws/notify")
async def push_notification(req: WsNotifyRequest):
    """
    Internal endpoint called by AI layer or backend services to push
    a real-time notification to a connected patient.
    """
    payload = {
        "type": req.type,
        "message": req.message,
        "session_id": req.session_id,
        "access_request_id": req.access_request_id,
        "use_type": req.use_type,
        "secondary_purpose": req.secondary_purpose,
        "data": req.data,
    }
    await manager.send_to_patient(req.patient_id, payload)
    return {"status": "sent", "connected_clients": len(manager.active_connections.get(req.patient_id, []))}


@router.get("/api/ws/status")
async def ws_status():
    """Check how many patients have active WebSocket connections."""
    return {
        "connected_patients": len(manager.active_connections),
        "connections": {
            str(pid): len(conns)
            for pid, conns in manager.active_connections.items()
        },
    }
