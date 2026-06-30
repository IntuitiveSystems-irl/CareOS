#!/usr/bin/env python3
"""
Bulk email sender for LaunchFlow using the Resend API.

Usage:
    python bulk_send.py --template welcome --csv recipients.csv
    python bulk_send.py --template newsletter --csv recipients.csv --subject "Big Update" --headline "New Features" --body "We shipped order tracking."
    python bulk_send.py --template announcement --csv recipients.csv --headline "Launch Day" --message "We're live!" --features "Order tracking,AI notes,Audit trail"

CSV format (with header row):
    email,name,role
    alice@example.com,Alice,patient
    bob@example.com,Bob,clinician
    carol@example.com,,general

Environment:
    RESEND_API_KEY   — required (or pass --api-key)
    RESEND_FROM      — optional, defaults to "LaunchFlow <onboarding@resend.dev>"
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

try:
    import resend
except ImportError:
    sys.exit("Missing dependency: pip install resend")

# Allow running from project root or backend/
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.email_templates import welcome_email, newsletter_email, announcement_email


def load_recipients(csv_path: str) -> list[dict]:
    """Load recipients from a CSV file. Expected columns: email, name (optional), role (optional)."""
    recipients = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = (row.get("email") or "").strip()
            if not email:
                continue
            recipients.append({
                "email": email,
                "name": (row.get("name") or "").strip(),
                "role": (row.get("role") or "general").strip(),
            })
    return recipients


def send_bulk(
    api_key: str,
    from_email: str,
    recipients: list[dict],
    template: str,
    subject: str,
    # newsletter / announcement kwargs
    headline: str = "",
    body_text: str = "",
    message: str = "",
    features: Optional[list[str]] = None,
    cta_text: str = "",
    cta_url: str = "",
    dry_run: bool = False,
    delay: float = 0.1,
) -> dict:
    """Send emails to all recipients. Returns summary stats."""
    resend.api_key = api_key

    stats = {"total": len(recipients), "sent": 0, "failed": 0, "errors": []}

    for i, r in enumerate(recipients, 1):
        email = r["email"]
        name = r.get("name", "")
        role = r.get("role", "general")

        # Build HTML from selected template
        if template == "welcome":
            html = welcome_email(name=name, role=role, email=email)
            subj = subject or "Welcome to LaunchFlow — Patient Health Data Agent"

        elif template == "newsletter":
            paragraphs = [p.strip() for p in body_text.split("\\n") if p.strip()] if body_text else []
            html = newsletter_email(
                name=name,
                headline=headline or "What's New at LaunchFlow",
                body_paragraphs=paragraphs,
                cta_text=cta_text or "Learn More",
                cta_url=cta_url or "https://launchflow.tech",
                email=email,
            )
            subj = subject or headline or "LaunchFlow Update"

        elif template == "announcement":
            html = announcement_email(
                name=name,
                headline=headline or "Announcement",
                message=message,
                features=features,
                cta_text=cta_text or "Check It Out",
                cta_url=cta_url or "https://launchflow.tech",
                email=email,
            )
            subj = subject or headline or "LaunchFlow Announcement"

        else:
            sys.exit(f"Unknown template: {template}")

        if dry_run:
            print(f"  [{i}/{stats['total']}] DRY RUN → {email} ({name or 'no name'})")
            stats["sent"] += 1
            continue

        try:
            resp = resend.Emails.send({
                "from": from_email,
                "to": [email],
                "subject": subj,
                "html": html,
            })
            stats["sent"] += 1
            print(f"  [{i}/{stats['total']}] ✓ {email}  (id: {resp.get('id', '?')})")
        except Exception as exc:
            stats["failed"] += 1
            stats["errors"].append({"email": email, "error": str(exc)})
            print(f"  [{i}/{stats['total']}] ✗ {email}  ({exc})")

        # Small delay to respect rate limits
        if delay and i < stats["total"]:
            time.sleep(delay)

    return stats


def main():
    parser = argparse.ArgumentParser(description="LaunchFlow bulk email sender")
    parser.add_argument("--csv", required=True, help="Path to CSV with recipients (email,name,role)")
    parser.add_argument("--template", required=True, choices=["welcome", "newsletter", "announcement"],
                        help="Email template to use")
    parser.add_argument("--subject", default="", help="Email subject line (auto-generated if empty)")
    parser.add_argument("--headline", default="", help="Headline for newsletter/announcement")
    parser.add_argument("--body", default="", help="Body text for newsletter (use \\n for paragraphs)")
    parser.add_argument("--message", default="", help="Message for announcement template")
    parser.add_argument("--features", default="", help="Comma-separated feature list for announcement")
    parser.add_argument("--cta-text", default="", help="Call-to-action button text")
    parser.add_argument("--cta-url", default="", help="Call-to-action button URL")
    parser.add_argument("--api-key", default="", help="Resend API key (or set RESEND_API_KEY env var)")
    parser.add_argument("--from-email", default="", help="From address (default: LaunchFlow <onboarding@resend.dev>)")
    parser.add_argument("--dry-run", action="store_true", help="Preview recipients without sending")
    parser.add_argument("--delay", type=float, default=0.1, help="Seconds between sends (default: 0.1)")

    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("RESEND_API_KEY", "")
    if not api_key and not args.dry_run:
        sys.exit("ERROR: No API key. Set RESEND_API_KEY or pass --api-key")

    from_email = args.from_email or os.environ.get("RESEND_FROM", "LaunchFlow <onboarding@resend.dev>")

    # Load recipients
    recipients = load_recipients(args.csv)
    if not recipients:
        sys.exit("ERROR: No valid recipients found in CSV")

    features = [f.strip() for f in args.features.split(",") if f.strip()] if args.features else None

    print(f"\n{'=' * 52}")
    print(f"  LaunchFlow Bulk Email Sender")
    print(f"{'=' * 52}")
    print(f"  Template:    {args.template}")
    print(f"  Recipients:  {len(recipients)}")
    print(f"  From:        {from_email}")
    print(f"  Subject:     {args.subject or '(auto)'}")
    print(f"  Dry run:     {args.dry_run}")
    print(f"{'=' * 52}\n")

    if not args.dry_run:
        confirm = input(f"Send to {len(recipients)} recipients? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

    stats = send_bulk(
        api_key=api_key,
        from_email=from_email,
        recipients=recipients,
        template=args.template,
        subject=args.subject,
        headline=args.headline,
        body_text=args.body,
        message=args.message,
        features=features,
        cta_text=args.cta_text,
        cta_url=args.cta_url,
        dry_run=args.dry_run,
        delay=args.delay,
    )

    print(f"\n{'─' * 52}")
    print(f"  Done!  Sent: {stats['sent']}  Failed: {stats['failed']}  Total: {stats['total']}")
    if stats["errors"]:
        print(f"\n  Errors:")
        for err in stats["errors"]:
            print(f"    {err['email']}: {err['error']}")
    print()


if __name__ == "__main__":
    main()
