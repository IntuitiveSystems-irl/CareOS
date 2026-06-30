#!/usr/bin/env python3
"""
Send a sample HL7 v2.5 ADT^A01 message to the MLLP listener.

Usage:
    python scripts/send_test_hl7.py [--host 127.0.0.1] [--port 2575] [--tls]
                                    [--cafile CA.pem]
                                    [--message <path-to-hl7-file>]

Prints the HL7 ACK that comes back. Exit code is 0 on AA, non-zero on AE/AR.
"""
from __future__ import annotations

import argparse
import socket
import ssl
import sys
import time

VT = b"\x0b"
FS = b"\x1c"
CR = b"\x0d"

DEFAULT_HL7 = """MSH|^~\\&|EpicSandbox|HOSP|LAUNCHFLOW|RELAY|{ts}||ADT^A01|MSG{ts}|T|2.5
EVN|A01|{ts}
PID|1||MRN12345^^^HOSP^MR||Doe^John^Q||19800115|M|||123 Main St^^Madison^WI^53703^USA||608-555-0100|||S||ACC123456789|111-22-3333
PV1|1|I|ICU^101^A|EM|||1234567^Smith^Alice^A^Dr^MD|||CAR|||||||||V123|||||||||||||||||||||||||{ts}
DG1|1|I10|I21.9^Acute myocardial infarction unspecified^I10|||A
OBX|1|NM|1234-5^Glucose^LN||110|mg/dL|70-100|H|||F|||{ts}
OBX|2|NM|2345-6^Sodium^LN||140|mmol/L|136-145|N|||F|||{ts}
AL1|1|MA|7980^Penicillin|MO|Hives|20200101"""


def build_message(template: str) -> bytes:
    ts = time.strftime("%Y%m%d%H%M%S")
    return template.format(ts=ts).replace("\n", "\r").encode("utf-8")


def parse_ack(ack_bytes: bytes) -> tuple[str, str]:
    """Return (code, text) from the MSA segment of an HL7 ACK."""
    text = ack_bytes.decode("utf-8", errors="replace")
    text = text.strip("\r\x0b\x1c")
    for line in text.split("\r"):
        if line.startswith("MSA"):
            parts = line.split(line[3]) if len(line) > 3 else line.split("|")
            code = parts[1] if len(parts) > 1 else ""
            ack_text = parts[3] if len(parts) > 3 else ""
            return code.upper(), ack_text
    return "??", text[:200]


def send_one(host: str, port: int, msg: bytes, *, use_tls: bool, cafile: str | None) -> bytes:
    sock = socket.create_connection((host, port), timeout=10)
    try:
        if use_tls:
            ctx = ssl.create_default_context(cafile=cafile)
            if cafile is None:
                # Self-signed dev cert? Caller can pass --insecure but default refuses.
                pass
            sock = ctx.wrap_socket(sock, server_hostname=host)
        sock.sendall(VT + msg + FS + CR)
        # Read until <FS><CR>.
        buf = b""
        deadline = time.time() + 10
        while time.time() < deadline:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf += chunk
            if FS + CR in buf:
                break
        if VT in buf:
            buf = buf[buf.index(VT) + 1:]
        if FS + CR in buf:
            buf = buf[:buf.index(FS + CR)]
        return buf
    finally:
        try:
            sock.close()
        except Exception:  # noqa: BLE001
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2575)
    parser.add_argument("--tls", action="store_true",
                        help="connect over MLLP-over-TLS")
    parser.add_argument("--cafile",
                        help="CA bundle for verifying the server's cert")
    parser.add_argument("--message",
                        help="path to an HL7 message file (use literal \\r as segment sep)")
    parser.add_argument("--repeat", type=int, default=1,
                        help="send the message N times in one connection")
    args = parser.parse_args()

    if args.message:
        with open(args.message, "rb") as f:
            template = f.read().decode("utf-8")
    else:
        template = DEFAULT_HL7

    failures = 0
    for i in range(args.repeat):
        msg = build_message(template)
        print(f"\n--- send #{i+1} ({len(msg)} bytes) ---")
        try:
            ack = send_one(args.host, args.port, msg, use_tls=args.tls, cafile=args.cafile)
        except Exception as exc:  # noqa: BLE001
            print(f"  connection failed: {exc}")
            failures += 1
            continue
        code, text = parse_ack(ack)
        print(f"  ACK: {code}  {text}")
        if code != "AA":
            failures += 1

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
