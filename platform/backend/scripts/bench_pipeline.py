#!/usr/bin/env python3
"""
Microbenchmark for the in-process relay pipeline.

Measures wall-clock time for one PipelineMessage to traverse:
  raw HL7 v2 bytes  →  Hl7v2ToFhirTransform  →  in-memory CapturingTransport

No DB, no socket, no agent, no encryption. This isolates the cost of the
pipeline framework + HL7 parse + FHIR mapping. Real "EHR-emit → system-action"
end-to-end latency (as defined in docs/careos-architecture.md) is a strictly
larger number that includes MLLP framing, audit-chain INSERT, and agent run.

Run from backend/:
    python3 scripts/bench_pipeline.py [N]

Default N = 200 iterations + 50 warmups.
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
from app.integration.transforms.hl7v2_to_fhir import Hl7v2ToFhirTransform  # noqa: E402

RAW_HL7 = (
    b"MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|20260526120000||"
    b"ADT^A04|MSG_BENCH_001|T|2.5\r"
    b"PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M\r"
    b"PV1|1|I|ICU^101^A\r"
    b"DG1|1|I10|I21.9^Acute MI^I10\r"
    b"OBX|1|NM|1234-5^Glucose^LN||110|mg/dL|70-100|H|||F\r"
    b"AL1|1|MA|7980^Penicillin|MO|Hives\r"
)


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    warmup = 50

    captured: list[PipelineMessage] = []

    class CapturingTransport(Transport):
        name = "capture"

        async def process(self, m, ctx):
            captured.append(m)
            return [m]

    pipeline = Pipeline(
        name="bench",
        source_transforms=[Hl7v2ToFhirTransform(strict=False)],
        route=single_branch("out"),
        branches={"out": [CapturingTransport()]},
        ctx=PipelineContext(pipeline_name="bench"),
    )

    def make_msg() -> PipelineMessage:
        return PipelineMessage(
            body=RAW_HL7,
            source_id="bench",
            content_type="application/hl7-v2",
            listener_id="bench",
        )

    # Warm up the asyncio loop, JIT-able paths, and import caches.
    for _ in range(warmup):
        asyncio.run(pipeline.dispatch(make_msg()))
    captured.clear()

    samples_ms: list[float] = []
    for _ in range(n):
        m = make_msg()
        t0 = time.perf_counter()
        asyncio.run(pipeline.dispatch(m))
        samples_ms.append((time.perf_counter() - t0) * 1000.0)

    samples_ms.sort()
    p50 = samples_ms[len(samples_ms) // 2]
    p95 = samples_ms[int(len(samples_ms) * 0.95)]
    p99 = samples_ms[int(len(samples_ms) * 0.99)]

    print("LaunchFlow relay — pipeline microbenchmark")
    print(f"  host:        {platform.platform()}")
    print(f"  python:      {sys.version.split()[0]}")
    print(f"  iterations:  {n} (after {warmup} warmups)")
    print(f"  payload:     {len(RAW_HL7)}-byte HL7 v2.5 ADT^A04 (PID, PV1, DG1, OBX, AL1)")
    print(f"  path:        bytes → Hl7v2ToFhirTransform → in-memory CapturingTransport")
    print(f"  excludes:    DB, MLLP socket, audit-chain INSERT, agent run, encryption")
    print()
    print(f"  min:   {min(samples_ms):.3f} ms")
    print(f"  p50:   {p50:.3f} ms")
    print(f"  p95:   {p95:.3f} ms")
    print(f"  p99:   {p99:.3f} ms")
    print(f"  max:   {max(samples_ms):.3f} ms")
    print(f"  mean:  {statistics.fmean(samples_ms):.3f} ms")
    print(f"  stdev: {statistics.pstdev(samples_ms):.3f} ms")
    print(f"  captured: {len(captured)} bundles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
