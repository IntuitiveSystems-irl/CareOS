#!/usr/bin/env python3
"""
Decomposition benchmark.

Same payload as bench_pipeline.py, but times each component of the run
path independently so we can show the 0.17 ms is the sum of explainable
parts, not magic.

Layers measured:
  L0  asyncio.run(noop_coroutine)         ← event-loop create/destroy
  L1  parse_hl7_message(raw)              ← byte → segment/field/component split
  L2  hl7_message_to_fhir_bundle(parsed)  ← 5 mappers + Bundle assembly
  L3  L1 + L2 (pure, no asyncio)          ← what the agent path costs
  L4  Hl7v2ToFhirTransform.process(msg)   ← L1 + L2 + PipelineMessage mutation
  L5  Pipeline.dispatch(msg) full         ← L4 + router + capture transport
  L6  asyncio.run(pipeline.dispatch(msg)) ← L5 + event loop overhead = headline number
"""
from __future__ import annotations

import asyncio
import base64
import os
import platform
import secrets
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault(
    "LAUNCHFLOW_RELAY_KEK",
    base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
)

from app.integration.pipeline import (  # noqa: E402
    Pipeline, PipelineContext, PipelineMessage, Transport,
)
from app.integration.routes.rule_router import single_branch  # noqa: E402
from app.integration.transforms.hl7v2_to_fhir import (  # noqa: E402
    Hl7v2ToFhirTransform, hl7_message_to_fhir_bundle, parse_hl7_message,
)

RAW_HL7 = (
    b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
    b"ADT^A04|MSG_BENCH_001|T|2.5\r"
    b"PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M\r"
    b"PV1|1|I|ICU^101^A\r"
    b"DG1|1|I10|I21.9^Acute MI^I10\r"
    b"OBX|1|NM|1234-5^Glucose^LN||110|mg/dL|70-100|H|||F\r"
    b"AL1|1|MA|7980^Penicillin|MO|Hives\r"
)


def time_loop(label: str, fn, n: int = 500, warmup: int = 50) -> float:
    """Run fn() n times and return p50 in microseconds."""
    for _ in range(warmup):
        fn()
    samples = []
    for _ in range(n):
        t0 = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - t0) * 1_000_000)  # µs
    samples.sort()
    p50 = samples[len(samples) // 2]
    p95 = samples[int(len(samples) * 0.95)]
    print(f"  {label:<54} p50={p50:8.1f} µs   p95={p95:8.1f} µs")
    return p50


def main() -> int:
    print("LaunchFlow relay — pipeline decomposition")
    print(f"  host:    {platform.platform()}")
    print(f"  python:  {sys.version.split()[0]}")
    print()

    # L0: asyncio.run cost on a no-op coroutine
    async def noop():
        return None
    L0 = time_loop("L0  asyncio.run(noop_coroutine)", lambda: asyncio.run(noop()))

    # L1: HL7 parser
    L1 = time_loop("L1  parse_hl7_message(269 bytes, 6 segments)",
                   lambda: parse_hl7_message(RAW_HL7))

    # L2: HL7 → FHIR Bundle (after parse)
    pre_parsed = parse_hl7_message(RAW_HL7)
    L2 = time_loop("L2  hl7_message_to_fhir_bundle(parsed)",
                   lambda: hl7_message_to_fhir_bundle(pre_parsed))

    # L3: pure parse + bundle (no asyncio, no message wrapper)
    L3 = time_loop("L3  L1 + L2 (pure, no asyncio)",
                   lambda: hl7_message_to_fhir_bundle(parse_hl7_message(RAW_HL7)))

    # L4: Hl7v2ToFhirTransform.process — async coro called via asyncio.run
    transform = Hl7v2ToFhirTransform(strict=False)
    ctx = PipelineContext(pipeline_name="bench")
    def make_msg():
        return PipelineMessage(
            body=RAW_HL7,
            source_id="bench",
            content_type="application/hl7-v2",
            listener_id="bench",
        )
    L4 = time_loop("L4  asyncio.run(transform.process(msg))",
                   lambda: asyncio.run(transform.process(make_msg(), ctx)))

    # L5/L6: full pipeline dispatch
    captured: list = []
    class CapturingTransport(Transport):
        name = "capture"
        async def process(self, m, c):
            captured.append(m)
            return [m]
    pipeline = Pipeline(
        name="bench",
        source_transforms=[Hl7v2ToFhirTransform(strict=False)],
        route=single_branch("out"),
        branches={"out": [CapturingTransport()]},
        ctx=ctx,
    )
    L6 = time_loop("L6  asyncio.run(pipeline.dispatch(msg))  ← headline",
                   lambda: asyncio.run(pipeline.dispatch(make_msg())))

    print()
    print("Decomposition (each is independent p50, so they don't sum exactly):")
    print(f"  asyncio overhead alone:        {L0:6.1f} µs")
    print(f"  HL7 parse alone:               {L1:6.1f} µs")
    print(f"  HL7 → FHIR mapping alone:      {L2:6.1f} µs")
    print(f"  parse + map (no asyncio):      {L3:6.1f} µs")
    print(f"  transform via asyncio.run:     {L4:6.1f} µs")
    print(f"  full pipeline.dispatch:        {L6:6.1f} µs   ← 0.17 ms claim")
    print()
    print(f"  asyncio surcharge (L4 - L3):   {L4 - L3:6.1f} µs")
    print(f"  pipeline framing (L6 - L4):    {L6 - L4:6.1f} µs")
    print(f"  captured: {len(captured)} bundles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
