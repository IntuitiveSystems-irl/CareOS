#!/usr/bin/env python3
"""
Local smoke test for the relay framework.

Runs entirely in-process — no DB, no network, no docker. Verifies:
  1. HL7 parser
  2. HL7 → FHIR Bundle transform
  3. Envelope encryption (round-trip + tamper detection)
  4. Audit chain hash (determinism + sensitivity)
  5. MLLP framing + ACK builder
  6. Pipeline orchestration end-to-end with an in-memory transport
  7. IntakeAgent: should_process filter + summary card from a Bundle

Run from `backend/`:
    cd backend
    python3 scripts/test_relay_local.py

Exit code is 0 on success, 1 on any failure.

Note: This script avoids importing `app.config`/`app.database` so it works
even when `pydantic_settings` isn't installed in the system Python (only
inside the docker container). It tests the framework's pure-Python
modules — HL7 parsing, FHIR mapping, envelope crypto, hash chain, MLLP
framing, and the in-memory pipeline orchestrator.
"""
from __future__ import annotations

import asyncio
import base64
import os
import secrets
import sys
import traceback
from datetime import datetime
from pathlib import Path

# Make `import app.integration.*` work regardless of where this script is run.
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))

# Set a throwaway KEK for the envelope-encryption test BEFORE importing
# the crypto module so its KEK lookup succeeds.
os.environ.setdefault(
    "LAUNCHFLOW_RELAY_KEK",
    base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
)


# ── Tiny test runner ────────────────────────────────────────────────────────

PASS = "[PASS]"
FAIL = "[FAIL]"

results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    print(f"  {status} {name}{(' — ' + detail) if detail else ''}")
    results.append((name, condition, detail))
    return condition


def section(title: str) -> None:
    print(f"\n=== {title} ===")


# ── 1. HL7 parser ───────────────────────────────────────────────────────────

def test_hl7_parser() -> None:
    section("1. HL7 parser")
    from app.integration.transforms.hl7v2_to_fhir import parse_hl7_message

    raw = (
        b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
        b"ADT^A01|MSG001|T|2.5\r"
        b"PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M\r"
        b"PV1|1|I|ICU^101^A\r"
    )
    msg = parse_hl7_message(raw)
    check("3 segments parsed", len(msg.segments) == 3,
          f"got {[s.name for s in msg.segments]}")
    pid = msg.first("PID")
    check("PID-5 family = Doe", pid.component(5, 1) == "Doe")
    check("PID-5 given = John", pid.component(5, 2) == "John")
    check("PID-7 dob = 19800115", pid.component(7, 1) == "19800115")
    check("PID-8 sex = M", pid.component(8, 1) == "M")


# ── 2. HL7 → FHIR ───────────────────────────────────────────────────────────

def test_hl7_to_fhir() -> None:
    section("2. HL7 → FHIR Bundle transform")
    from app.integration.transforms.hl7v2_to_fhir import (
        hl7_message_to_fhir_bundle,
        parse_hl7_message,
    )

    raw = (
        b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
        b"ADT^A01|MSG001|T|2.5\r"
        b"PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M\r"
        b"PV1|1|I|ICU^101^A\r"
        b"DG1|1|I10|I21.9^Acute MI^I10\r"
        b"OBX|1|NM|1234-5^Glucose^LN||110|mg/dL|70-100|H|||F\r"
        b"AL1|1|MA|7980^Penicillin|MO|Hives\r"
    )
    bundle = hl7_message_to_fhir_bundle(parse_hl7_message(raw))
    check("bundle.type = transaction", bundle["type"] == "transaction")
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    check("Patient present", "Patient" in types)
    check("Encounter present", "Encounter" in types)
    check("Observation present", "Observation" in types)
    check("AllergyIntolerance present", "AllergyIntolerance" in types)
    check("Condition present", "Condition" in types)

    patient = next(e["resource"] for e in bundle["entry"]
                   if e["resource"]["resourceType"] == "Patient")
    check("Patient.gender = male", patient.get("gender") == "male")
    check("Patient.birthDate = 1980-01-15", patient.get("birthDate") == "1980-01-15")

    obs = next(e["resource"] for e in bundle["entry"]
               if e["resource"]["resourceType"] == "Observation")
    check("Observation.valueQuantity.value = 110.0",
          obs.get("valueQuantity", {}).get("value") == 110.0)
    check("Observation.valueQuantity.unit = mg/dL",
          obs.get("valueQuantity", {}).get("unit") == "mg/dL")


# ── 3. Envelope encryption ──────────────────────────────────────────────────

def test_envelope() -> None:
    section("3. Envelope encryption (AES-256-GCM)")
    from app.integration.crypto.envelope import (
        EnvelopeError,
        decrypt,
        encrypt,
        kek_fingerprint,
    )

    pt = b"PATIENT-NAME: John Doe; MRN: 12345"
    aad = b"msg_test_123"
    ct = encrypt(pt, aad=aad)
    check("ciphertext is longer than plaintext", len(ct) > len(pt))
    check("round-trip OK", decrypt(ct, aad=aad) == pt)
    check("KEK fingerprint is 16 hex chars", len(kek_fingerprint()) == 16)

    try:
        decrypt(ct, aad=b"wrong_aad")
        check("wrong AAD rejected", False, "decrypt did not raise")
    except EnvelopeError:
        check("wrong AAD rejected", True)

    tampered = bytearray(ct)
    tampered[-3] ^= 0x01
    try:
        decrypt(bytes(tampered), aad=aad)
        check("ciphertext tamper rejected", False, "decrypt did not raise")
    except EnvelopeError:
        check("ciphertext tamper rejected", True)


# ── 4. Audit chain hash ─────────────────────────────────────────────────────

def test_audit_chain() -> None:
    section("4. Audit chain hash")
    # Import from `_hash` directly so we don't drag SQLAlchemy in.
    from app.integration.audit._hash import GENESIS_HASH, sha256_bytes, sign_row

    ts = datetime(2026, 5, 26, 12, 0, 0)
    h1 = sign_row(
        ts=ts, actor="hl7_mllp", action="received",
        hash_prev=GENESIS_HASH,
        message_id="msg_a", content_sha256="abc",
    )
    h2 = sign_row(
        ts=ts, actor="relay", action="phi_write",
        hash_prev=h1,
        message_id="msg_a", resource_type="Patient", resource_id="123",
    )
    h2_dup = sign_row(
        ts=ts, actor="relay", action="phi_write",
        hash_prev=h1,
        message_id="msg_a", resource_type="Patient", resource_id="123",
    )
    h2_alt = sign_row(
        ts=ts, actor="relay", action="phi_write",
        hash_prev="d" * 64,
        message_id="msg_a", resource_type="Patient", resource_id="123",
    )

    check("h1 is 64 hex chars", len(h1) == 64 and all(c in "0123456789abcdef" for c in h1))
    check("h2 deterministic (same inputs → same hash)", h2 == h2_dup)
    check("h2 sensitive to hash_prev (different prev → different hash)", h2 != h2_alt)
    check("h1 != h2 (different fields → different hash)", h1 != h2)

    # sha256_bytes helper
    digest = sha256_bytes(b"hello")
    check(
        "sha256_bytes('hello') matches known value",
        digest == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    )


# ── 5. MLLP framing + ACK builder ───────────────────────────────────────────

def test_mllp_framing() -> None:
    section("5. MLLP framing + ACK builder")
    from app.integration.listeners.hl7_mllp import (
        MLLP_END_FRAME,
        MLLP_START_BLOCK,
        _parse_msh,
        build_ack,
    )

    raw = (
        b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
        b"ADT^A01|MSG001|T|2.5\r"
        b"PID|1||MRN12345||Doe^John\r"
    )
    msh = _parse_msh(raw)
    check("parsed MSH-9 message_type = ADT^A01", msh["message_type"] == "ADT^A01")
    check("parsed MSH-10 control_id = MSG001", msh["control_id"] == "MSG001")
    check("parsed MSH-3 sending_app = EpicSandbox", msh["sending_app"] == "EpicSandbox")

    ack = build_ack(msh, code="AA", text_message="OK")
    text = ack.decode()
    check("ACK starts with MSH", text.startswith("MSH"))
    check("ACK contains MSA segment", "\rMSA|AA|MSG001|" in text)
    check("ACK echoes original control_id", "|MSG001|" in text)
    check(
        "MLLP_START_BLOCK is <VT>",
        MLLP_START_BLOCK == b"\x0b",
    )
    check(
        "MLLP_END_FRAME is <FS><CR>",
        MLLP_END_FRAME == b"\x1c\x0d",
    )

    # Try a malformed MSH path → AR ACK
    try:
        _parse_msh(b"NOT_HL7\r")
        check("malformed MSH rejected", False, "_parse_msh did not raise")
    except Exception:
        check("malformed MSH rejected", True)


# ── 6. Pipeline orchestration ───────────────────────────────────────────────

def test_pipeline_orchestration() -> None:
    section("6. Pipeline orchestration end-to-end")
    from app.integration.pipeline import (
        Pipeline,
        PipelineContext,
        PipelineMessage,
        Transport,
    )
    from app.integration.routes.rule_router import single_branch
    from app.integration.transforms.hl7v2_to_fhir import Hl7v2ToFhirTransform

    captured: list[PipelineMessage] = []

    class CapturingTransport(Transport):
        name = "capture"

        async def process(self, m, ctx):
            captured.append(m)
            return [m]

    pipeline = Pipeline(
        name="test",
        source_transforms=[Hl7v2ToFhirTransform(strict=False)],
        route=single_branch("out"),
        branches={"out": [CapturingTransport()]},
        ctx=PipelineContext(pipeline_name="test"),
    )

    raw = (
        b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
        b"ADT^A01|MSG001|T|2.5\r"
        b"PID|1||MRN12345||Doe^John\r"
    )
    inbound = PipelineMessage(
        body=raw,
        source_id="test_src",
        content_type="application/hl7-v2",
        listener_id="test_listener",
    )

    async def go():
        return await pipeline.dispatch(inbound)

    results_list = asyncio.run(go())

    check("pipeline produced 1 terminal result", len(results_list) == 1)
    check("transport captured 1 message", len(captured) == 1)
    if captured:
        m = captured[0]
        check(
            "captured message has FHIR Bundle body",
            isinstance(m.body, dict) and m.body.get("resourceType") == "Bundle",
        )
        check(
            "captured content_type is application/fhir+json",
            m.content_type == "application/fhir+json",
        )
        check(
            "metadata has hl7_message_type = ADT^A01",
            m.metadata.get("hl7_message_type") == "ADT^A01",
        )
        check(
            "metadata.route is 'out'",
            m.metadata.get("route") == "out",
        )

    stats = pipeline.stats()
    check("pipeline stats: dispatched == 1", stats.get("dispatched") == 1)
    check("pipeline stats: completed == 1", stats.get("completed") == 1)
    check("pipeline stats: failed == 0", stats.get("failed") == 0)


# ── 7. Intake Agent ─────────────────────────────────────────────────────────

def test_intake_agent() -> None:
    section("7. IntakeAgent")
    from app.integration.agents.intake import IntakeAgent
    from app.integration.pipeline import PipelineContext, PipelineMessage
    from app.integration.transforms.hl7v2_to_fhir import (
        hl7_message_to_fhir_bundle,
        parse_hl7_message,
    )

    raw = (
        b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
        b"ADT^A04|MSG_INTAKE_001|T|2.5\r"
        b"PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M\r"
        b"PV1|1|I|ICU^101^A\r"
        b"DG1|1|I10|I21.9^Acute MI^I10\r"
        b"OBX|1|NM|1234-5^Glucose^LN||110|mg/dL|70-100|H|||F\r"
        b"AL1|1|MA|7980^Penicillin|MO|Hives\r"
    )
    bundle = hl7_message_to_fhir_bundle(parse_hl7_message(raw))

    msg = PipelineMessage(
        body=bundle,
        source_id="hl7_mllp",
        content_type="application/fhir+json",
        listener_id="hl7_mllp",
        headers={"hl7_control_id": "MSG_INTAKE_001",
                 "hl7_sending_facility": "HOSP"},
        metadata={"hl7_message_type": "ADT^A04"},
    )

    agent = IntakeAgent()
    check("agent.should_process(ADT^A04) is True", agent.should_process(msg))

    # Build a non-trigger message to confirm filter is selective.
    msg_oru = PipelineMessage(
        body=bundle, source_id="x", content_type="application/fhir+json",
        listener_id="x", metadata={"hl7_message_type": "ORU^R01"},
    )
    check("agent.should_process(ORU^R01) is False", not agent.should_process(msg_oru))

    # Run the agent end-to-end (no DB; persistence is best-effort and skips
    # silently when ctx.db_session_factory is None).
    ctx = PipelineContext(pipeline_name="test")
    out_messages = asyncio.run(agent.process(msg, ctx))

    check("agent.process returns 1 pass-through message", len(out_messages) == 1)
    check(
        "metadata.agent_results has 1 entry",
        len(msg.metadata.get("agent_results", [])) == 1,
    )

    if msg.metadata.get("agent_results"):
        result = msg.metadata["agent_results"][0]
        check("agent_id == intake_agent", result["agent_id"] == "intake_agent")
        check(
            "status is succeeded or flagged",
            result["status"] in {"succeeded", "flagged"},
        )
        out = result.get("output", {})
        # Patient block
        patient_block = out.get("patient", {})
        check(
            "summary.patient.external_id == MRN12345",
            patient_block.get("external_id") == "MRN12345",
        )
        check(
            "summary.patient.gender == male",
            patient_block.get("gender") == "male",
        )
        check(
            "summary.patient.birth_year == 1980",
            patient_block.get("birth_year") == 1980,
        )
        check(
            "summary.patient.display_name first-initial format",
            patient_block.get("display_name") == "J. Doe",
        )
        # Counts
        counts = out.get("counts", {})
        check("counts.conditions >= 1", counts.get("conditions", 0) >= 1)
        check("counts.allergies >= 1", counts.get("allergies", 0) >= 1)
        check("counts.observations >= 1", counts.get("observations", 0) >= 1)
        # Admin savings
        savings = out.get("admin_savings", {})
        check(
            "admin_savings.actions_replaced > 0",
            savings.get("actions_replaced", 0) > 0,
        )
        check(
            "admin_savings.minutes_saved_est > 0",
            savings.get("minutes_saved_est", 0) > 0,
        )

    # Skip path: a message with no FHIR Bundle should be marked skipped.
    msg_empty = PipelineMessage(
        body=b"raw bytes", source_id="x",
        content_type="application/hl7-v2", listener_id="x",
        metadata={"hl7_message_type": "ADT^A04"},
    )
    asyncio.run(agent.process(msg_empty, ctx))
    if msg_empty.metadata.get("agent_results"):
        check(
            "non-FHIR body → status=skipped",
            msg_empty.metadata["agent_results"][0]["status"] == "skipped",
        )


# ── Main ────────────────────────────────────────────────────────────────────

TESTS = [
    test_hl7_parser,
    test_hl7_to_fhir,
    test_envelope,
    test_audit_chain,
    test_mllp_framing,
    test_pipeline_orchestration,
    test_intake_agent,
]


def main() -> int:
    print("LaunchFlow relay — local smoke test")
    print(f"  cwd: {os.getcwd()}")
    print(f"  python: {sys.version.split(chr(10))[0]}")
    fatal_errors: list[tuple[str, str]] = []
    for fn in TESTS:
        try:
            fn()
        except Exception:
            fatal_errors.append((fn.__name__, traceback.format_exc()))
            print(f"  {FAIL} {fn.__name__} raised:\n{traceback.format_exc()}")

    section("Summary")
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"  {passed} / {total} checks passed")
    if fatal_errors:
        print(f"  {len(fatal_errors)} test(s) raised exceptions")
    if passed == total and not fatal_errors:
        print("\nAll checks passed.")
        return 0
    print("\nSome checks failed.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
