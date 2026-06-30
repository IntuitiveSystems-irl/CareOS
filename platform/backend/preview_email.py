#!/usr/bin/env python3
"""Generate HTML previews of all email templates and open in browser."""

import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.email_templates import welcome_email, newsletter_email, announcement_email, outreach_email

out_dir = Path(__file__).resolve().parent / "_preview"
out_dir.mkdir(exist_ok=True)

# Welcome
(out_dir / "welcome.html").write_text(
    welcome_email(name="Sarah Chen", role="patient", email="sarah@example.com")
)

# Newsletter
(out_dir / "newsletter.html").write_text(
    newsletter_email(
        name="Sarah Chen",
        headline="Patient Order Review is Live",
        body_paragraphs=[
            "We just shipped a major update: patients can now review and approve clinical orders directly from the portal before they execute.",
            "This means full informed consent at every step — no surprises. Clinicians compose orders, patients approve them, and the system handles the rest.",
            "We've also improved the clinical notes AI translation to be even more accurate and readable.",
        ],
        cta_text="Try It Now",
        cta_url="https://launchflow.tech",
        email="sarah@example.com",
    )
)

# Announcement
(out_dir / "announcement.html").write_text(
    announcement_email(
        name="Sarah Chen",
        headline="LaunchFlow is Now Live",
        message="We're excited to announce that LaunchFlow is officially available. Start managing your health data today.",
        features=[
            "Patient-controlled data access across Epic, Cerner & MEDITECH",
            "AI-powered clinical note translation",
            "Real-time audit trail for every access event",
            "Order review and approval workflow",
        ],
        cta_text="Get Started",
        cta_url="https://launchflow.tech",
        email="sarah@example.com",
    )
)

# Cold Outreach
(out_dir / "outreach.html").write_text(
    outreach_email(
        last_name="Martinez",
        title="Dr.",
        email="martinez@examplehealth.org",
    )
)

print(f"Previews saved to {out_dir}/")
for f in sorted(out_dir.glob("*.html")):
    print(f"  → {f.name}")

webbrowser.open(str(out_dir / "outreach.html"))
