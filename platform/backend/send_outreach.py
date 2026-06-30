#!/usr/bin/env python3
"""Send the LaunchFlow outreach email to the first 100 pending leads via Resend API."""

import csv
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.email_templates import outreach_email

RESEND_API_KEY = "REDACTED_RESEND_KEY"
FROM_EMAIL = "Lindsay Bachman <lindsay@launchflow.tech>"
SUBJECT = "Patient-Authorized Coordination Layer \u2014 SMART on FHIR Prototype"
LEADS_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.csv")
BATCH_LIMIT = 100


def load_leads():
    with open(LEADS_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_leads(rows):
    with open(LEADS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "status"])
        writer.writeheader()
        writer.writerows(rows)


def send_email(to_email, html):
    """Send a single email via Resend API using curl."""
    payload = json.dumps({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": SUBJECT,
        "html": html,
    })

    try:
        result = subprocess.run(
            [
                "curl", "-s", "-w", "\n%{http_code}",
                "-X", "POST", "https://api.resend.com/emails",
                "-H", f"Authorization: Bearer {RESEND_API_KEY}",
                "-H", "Content-Type: application/json",
                "-d", payload,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        lines = result.stdout.strip().rsplit("\n", 1)
        body_str = lines[0] if len(lines) > 1 else ""
        http_code = int(lines[-1]) if lines else 0

        try:
            body = json.loads(body_str)
        except Exception:
            body = {"message": body_str or "empty response"}

        if 200 <= http_code < 300:
            return True, http_code, body
        else:
            return False, http_code, body
    except Exception as e:
        return False, 0, {"error": str(e)}


def main():
    rows = load_leads()
    pending = [(i, r) for i, r in enumerate(rows) if r["status"] == "pending"]
    to_send = pending[:BATCH_LIMIT]

    print(f"\n{'='*60}")
    print(f"  LaunchFlow Outreach — {len(to_send)} of {len(pending)} pending")
    print(f"  From: {FROM_EMAIL}")
    print(f"  Subject: {SUBJECT}")
    print(f"{'='*60}\n")

    sent = 0
    failed = 0
    errors = []

    for count, (idx, row) in enumerate(to_send, 1):
        name = row["name"]
        email = row["email"]
        html = outreach_email(last_name=name, title="", email=email)

        success, status, body = send_email(email, html)
        if success:
            rows[idx]["status"] = "sent"
            sent += 1
            print(f"  [{count}/{len(to_send)}] sent -> {email}")
        else:
            rows[idx]["status"] = "failed"
            failed += 1
            err_msg = body.get("message", body.get("error", f"HTTP {status}"))
            errors.append(f"{email}: {err_msg}")
            print(f"  [{count}/{len(to_send)}] FAILED -> {email} -- {err_msg}")

        # Save progress every 10 emails
        if count % 10 == 0:
            save_leads(rows)

        # Rate limit: ~1 per second
        if count < len(to_send):
            time.sleep(1)

    # Final save
    save_leads(rows)

    remaining = len(pending) - len(to_send)
    print(f"\n{'='*60}")
    print(f"  Done!  Sent: {sent}  Failed: {failed}  Remaining: {remaining}")
    print(f"{'='*60}")

    if errors:
        print(f"\n  Errors:")
        for e in errors:
            print(f"    - {e}")
    print()


if __name__ == "__main__":
    main()
