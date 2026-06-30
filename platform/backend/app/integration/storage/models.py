"""
Relay-side SQLAlchemy models.

`RelayInboundMessage`
    Raw inbound payload per listener message. Body is envelope-encrypted
    via `app.integration.crypto.envelope.encrypt()`; the AAD bound into the
    ciphertext is the row's `message_id` so a body moved to a different
    row will fail decryption.

`RelayFhirResource`
    Extracted FHIR resources from an inbound message. One row per resource
    in the Bundle. Lets us index/search without decrypting the inbound blob.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text, JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RelayInboundMessage(Base):
    """One inbound message (HL7v2, FHIR Bundle, CDA…) accepted by a listener."""
    __tablename__ = "relay_inbound_messages"

    id = Column(Integer, primary_key=True, index=True)
    # Stable per-message UUID set by the listener — used in audit + AAD.
    message_id = Column(String(80), nullable=False, unique=True, index=True)
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Provenance
    listener_id = Column(String(80), nullable=False, index=True)
    source_id = Column(String(120), nullable=False, index=True)
    peer = Column(String(120), nullable=True)             # remote address, useful for forensics
    content_type = Column(String(80), nullable=False)
    # Hash of the raw inbound bytes BEFORE any transform — proves integrity.
    inbound_sha256 = Column(String(64), nullable=False)

    # HL7-specific (nullable for non-HL7 sources)
    hl7_message_type = Column(String(20), nullable=True, index=True)
    hl7_control_id = Column(String(80), nullable=True, index=True)
    hl7_processing_id = Column(String(4), nullable=True)
    hl7_version = Column(String(10), nullable=True)

    # Envelope-encrypted body (raw bytes from the wire). AAD = message_id.
    encrypted_body = Column(LargeBinary, nullable=False)
    # Short fingerprint of the KEK used — eases key-rotation operations.
    kek_fingerprint = Column(String(32), nullable=False)

    # FHIR Bundle that the source-transform produced (encrypted or not —
    # storing as JSON for now; columns can move to encrypted blob later).
    fhir_bundle = Column(JSON, nullable=True)

    # Outcome of the pipeline run for this message.
    status = Column(String(20), default="received", nullable=False, index=True)
    error = Column(Text, nullable=True)

    resources = relationship(
        "RelayFhirResource",
        back_populates="message",
        cascade="all, delete-orphan",
    )


class RelayFhirResource(Base):
    """A single FHIR resource extracted from a `RelayInboundMessage`."""
    __tablename__ = "relay_fhir_resources"

    id = Column(Integer, primary_key=True, index=True)
    inbound_message_id = Column(
        Integer, ForeignKey("relay_inbound_messages.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    resource_type = Column(String(80), nullable=False, index=True)
    resource_id = Column(String(160), nullable=False, index=True)
    # Origin-system identifier (MRN, FHIR resource id at the source EHR).
    external_id = Column(String(160), nullable=True, index=True)
    source_id = Column(String(120), nullable=False, index=True)
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Raw FHIR JSON for this resource. Stored plaintext for indexability;
    # move to LargeBinary + envelope encryption when PHI policy requires it.
    resource_json = Column(JSON, nullable=False)
    # SHA-256 of the canonical resource_json — for dedup / integrity checks.
    content_sha256 = Column(String(64), nullable=False, index=True)

    message = relationship("RelayInboundMessage", back_populates="resources")


Index(
    "ix_relay_resources_source_type_extid",
    RelayFhirResource.source_id,
    RelayFhirResource.resource_type,
    RelayFhirResource.external_id,
)
