import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.routers import (
    patients,
    organizations,
    access_requests,
    clinical_notes,
    payments,
    notifications,
    access_logs,
    fhir,
    smart_auth,
    websocket,
    patient_portal,
    fulfillment,
    ehr_adapters,
    ehr_connect,
    relational_chart,
    clinicians,
    patient_feedback,
    cds_hooks,
    orders,
    email,
    epic_backend,
    relay,
    careos,
    bulk_data,
    web3_economy,
    checkin,
    data_pool,
    cds_hooks_web3,
)

# Importing the integration packages ensures their SQLAlchemy models are
# registered with Base.metadata before create_all runs.
import app.integration.audit.models  # noqa: F401
import app.integration.storage.models  # noqa: F401
import app.integration.agents.models  # noqa: F401
import app.research.models  # noqa: F401
from app.integration.registry import get_relay
from app.research.router import router as research_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    # Start the relay (HL7 MLLP listener + pipelines). Failures here must
    # not block API startup — the relay surfaces its own health at
    # /api/relay/status so operators can see it's down.
    relay_instance = get_relay()
    try:
        await relay_instance.start()
    except Exception:  # noqa: BLE001
        logger.exception("Relay failed to start; API will continue")

    try:
        yield
    finally:
        try:
            await relay_instance.stop()
        except Exception:  # noqa: BLE001
            logger.exception("Relay failed to stop cleanly")


app = FastAPI(
    title="Patient Health Data Agent",
    description="Patient-controlled health data agent with EHR access requests",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(organizations.router)
app.include_router(access_requests.router)
app.include_router(clinical_notes.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(access_logs.router)
app.include_router(fhir.router)
app.include_router(smart_auth.router)
app.include_router(websocket.router)
app.include_router(patient_portal.router)
app.include_router(fulfillment.router)
app.include_router(ehr_adapters.router)
app.include_router(ehr_connect.router)
app.include_router(relational_chart.router)
app.include_router(clinicians.router)
app.include_router(patient_feedback.router)
app.include_router(cds_hooks.router)
app.include_router(orders.router)
app.include_router(email.router)
app.include_router(epic_backend.wellknown_router)
app.include_router(epic_backend.router)
app.include_router(relay.router)
app.include_router(careos.router)
app.include_router(bulk_data.router)
app.include_router(web3_economy.router)
app.include_router(checkin.router)
app.include_router(data_pool.router)
app.include_router(cds_hooks_web3.router)
app.include_router(research_router)


# ── FHIR OperationOutcome error handlers ─────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def fhir_validation_error_handler(request: Request, exc: RequestValidationError):
    """Return FHIR OperationOutcome for validation errors on /fhir/* paths."""
    if request.url.path.startswith("/fhir"):
        issues = []
        for err in exc.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            issues.append({
                "severity": "error",
                "code": "invalid",
                "details": {"text": f"{loc}: {err.get('msg', 'Validation error')}"},
            })
        return JSONResponse(
            status_code=422,
            content={"resourceType": "OperationOutcome", "issue": issues},
            media_type="application/fhir+json",
        )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(500)
async def fhir_server_error_handler(request: Request, exc: Exception):
    """Return FHIR OperationOutcome for unhandled 500s on /fhir/* paths."""
    if request.url.path.startswith("/fhir"):
        return JSONResponse(
            status_code=500,
            content={
                "resourceType": "OperationOutcome",
                "issue": [{"severity": "error", "code": "exception", "details": {"text": "Internal server error"}}],
            },
            media_type="application/fhir+json",
        )
    raise exc


@app.get("/")
def root():
    return {"status": "ok", "service": "Patient Health Data Agent API"}
