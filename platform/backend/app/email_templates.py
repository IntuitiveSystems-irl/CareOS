from typing import Optional

"""
Branded HTML email templates for LaunchFlow — Patient Health Data Agent.

Palette (from patient portal):
  Teal:   #4ab4b4 (400), #319999 (500), #267a7d (600)
  Sage:   #d4daca (200), #b5c0a7 (300)
  Warm:   #faf8f5 (50), #f3efe8 (100)
  Gray:   #111827 (900), #374151 (700), #6b7280 (500), #9ca3af (400)
  Font:   Inter / system-ui / -apple-system
"""

# ── Shared fragments ────────────────────────────────────────────────────────

_FONT_STACK = (
    "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, "
    "Helvetica, Arial, sans-serif"
)

_HEADER = """
<div style="text-align: center; margin-bottom: 32px;">
    <div style="display: inline-block; background: linear-gradient(135deg, #4ab4b4, #267a7d); border-radius: 14px; padding: 14px; margin-bottom: 16px; box-shadow: 0 0 20px rgba(49,153,153,0.12);">
        <span style="color: white; font-size: 26px; line-height: 1;">&#9829;</span>
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0; letter-spacing: -0.3px;">LaunchFlow</h1>
    <p style="font-size: 10px; font-weight: 700; color: #319999; text-transform: uppercase; letter-spacing: 2.5px; margin: 6px 0 0;">Health Data Agent</p>
</div>
"""

_FOOTER = """
<hr style="border: none; border-top: 1px solid #e8ebe3; margin: 36px 0 24px;" />
<div style="text-align: center;">
    <p style="font-size: 11px; color: #9ca3af; line-height: 1.7; margin: 0 0 8px;">
        University of Washington &middot; Patient Health Data Agent
    </p>
    <p style="font-size: 10px; color: #d4daca; margin: 0;">
        SMART on FHIR &middot; HIPAA Compliant &middot; FHIR R4 &middot; US Core STU7
    </p>
</div>
"""

_UNSUBSCRIBE = """
<p style="text-align: center; margin-top: 20px;">
    <a href="https://launchflow.tech/unsubscribe?email={email}" style="font-size: 11px; color: #9ca3af; text-decoration: underline;">
        Unsubscribe
    </a>
</p>
"""


def _wrap(body_html: str, email: str = "") -> str:
    """Wrap body content in the full email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #faf8f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf8f5;">
<tr><td align="center" style="padding: 40px 16px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; border: 1px solid #e8ebe3; box-shadow: 0 2px 15px -3px rgba(0,0,0,0.04); overflow: hidden;">

<!-- Teal accent bar -->
<tr><td style="height: 4px; background: linear-gradient(90deg, #4ab4b4, #267a7d);"></td></tr>

<!-- Body -->
<tr><td style="padding: 40px 40px 32px; font-family: {_FONT_STACK};">
{_HEADER}
{body_html}
{_FOOTER}
{_UNSUBSCRIBE.format(email=email)}
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


# ── Template: Welcome ────────────────────────────────────────────────────────

def welcome_email(name: str = "", role: str = "general", email: str = "") -> str:
    role_label = {
        "patient": "Patient",
        "clinician": "Clinician",
        "general": "Healthcare Professional",
    }.get(role, "Healthcare Professional")

    greeting = f"Hi {name}," if name else "Hi there,"

    body = f"""
    <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 12px;">{greeting}</p>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 24px;">
        Thank you for your interest in LaunchFlow as a <strong style="color: #374151;">{role_label}</strong>.
        You're now on the list for updates about patient-controlled health data access.
    </p>

    <div style="background: linear-gradient(135deg, #f0fafa, #faf8f5); border: 1px solid #d4f1f1; border-radius: 14px; padding: 24px; margin: 0 0 24px;">
        <p style="font-size: 14px; color: #267a7d; margin: 0 0 12px; font-weight: 700;">What LaunchFlow does</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <span style="color: #319999; margin-right: 8px;">&#10003;</span>
                Patient-controlled access to health records across EHR systems
            </td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <span style="color: #319999; margin-right: 8px;">&#10003;</span>
                Live FHIR connections to Epic, Cerner &amp; MEDITECH
            </td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <span style="color: #319999; margin-right: 8px;">&#10003;</span>
                AI-powered clinical note translation to plain language
            </td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <span style="color: #319999; margin-right: 8px;">&#10003;</span>
                Real-time audit trail for every data access event
            </td></tr>
        </table>
    </div>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 28px;">
        We'll keep you updated on new features, launch milestones, and early access opportunities.
    </p>

    <div style="text-align: center;">
        <a href="https://launchflow.tech" style="display: inline-block; background: linear-gradient(135deg, #4ab4b4, #267a7d); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 0 20px rgba(49,153,153,0.12);">
            Visit LaunchFlow &rarr;
        </a>
    </div>
    """
    return _wrap(body, email)


# ── Template: Newsletter / Update ────────────────────────────────────────────

def newsletter_email(
    name: str = "",
    subject_preview: str = "",
    headline: str = "What's New at LaunchFlow",
    body_paragraphs: Optional[list[str]] = None,
    cta_text: str = "Learn More",
    cta_url: str = "https://launchflow.tech",
    email: str = "",
) -> str:
    greeting = f"Hi {name}," if name else "Hi there,"
    paragraphs_html = ""
    for p in (body_paragraphs or []):
        paragraphs_html += f'<p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">{p}</p>\n'

    body = f"""
    <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 12px;">{greeting}</p>

    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 20px; letter-spacing: -0.3px;">{headline}</h2>

    {paragraphs_html}

    <div style="text-align: center; margin: 28px 0;">
        <a href="{cta_url}" style="display: inline-block; background: linear-gradient(135deg, #4ab4b4, #267a7d); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 0 20px rgba(49,153,153,0.12);">
            {cta_text} &rarr;
        </a>
    </div>
    """
    return _wrap(body, email)


# ── Template: Announcement ──────────────────────────────────────────────────

def announcement_email(
    name: str = "",
    headline: str = "",
    message: str = "",
    features: Optional[list[str]] = None,
    cta_text: str = "Check It Out",
    cta_url: str = "https://launchflow.tech",
    email: str = "",
) -> str:
    greeting = f"Hi {name}," if name else "Hi there,"

    features_html = ""
    if features:
        rows = ""
        for f in features:
            rows += f"""<tr><td style="padding: 6px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <span style="color: #319999; margin-right: 8px;">&#9679;</span> {f}
            </td></tr>"""
        features_html = f"""
        <div style="background: linear-gradient(135deg, #f0fafa, #faf8f5); border: 1px solid #d4f1f1; border-radius: 14px; padding: 20px; margin: 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">{rows}</table>
        </div>
        """

    body = f"""
    <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 12px;">{greeting}</p>

    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px; letter-spacing: -0.3px;">{headline}</h2>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">{message}</p>

    {features_html}

    <div style="text-align: center; margin: 28px 0;">
        <a href="{cta_url}" style="display: inline-block; background: linear-gradient(135deg, #4ab4b4, #267a7d); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 0 20px rgba(49,153,153,0.12);">
            {cta_text} &rarr;
        </a>
    </div>
    """
    return _wrap(body, email)


# ── Template: Cold Outreach (Healthcare Executives) ─────────────────────────

def outreach_email(
    last_name: str = "",
    title: str = "Dr.",
    email: str = "",
) -> str:
    """
    Cold outreach to CIOs, COOs, and healthcare business leaders.
    Professional, personal tone — not a marketing blast.
    """
    greeting = f"Hi {title} {last_name}," if last_name else "Hi there,"

    body = f"""
    <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 16px;">{greeting}</p>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">
        My name is Lindsay Bachman and I'm a Clinical Informatics graduate student at the University of Washington
        studying care coordination, interoperability, and clinician cognitive load across EHR systems.
    </p>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">
        I built a prototype modeling a patient-authorized coordination layer over Epic, Cerner (Oracle Health),
        and MEDITECH using SMART on FHIR.
    </p>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">
        It performs live SMART discovery, OAuth authorization, metadata parsing, and retrieval of US Core FHIR R4
        resources (Patient, Condition, MedicationRequest, Observation, etc.) through vendor-specific adapters.
    </p>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 24px;">
        The idea is to explore whether patient-mediated visibility across referrals, labs, and prescriptions
        could reduce some of the coordination friction that contributes to workflow fragmentation and clinician burnout.
    </p>

    <p style="font-size: 14px; color: #267a7d; font-weight: 700; margin: 0 0 12px;">Prototype:</p>

    <div style="text-align: center; margin: 0 0 28px;">
        <a href="https://launchflow.tech" style="display: inline-block; background: linear-gradient(135deg, #4ab4b4, #267a7d); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 0 20px rgba(49,153,153,0.12);">
            View system &rarr;
        </a>
    </div>

    <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 16px;">
        Curious whether a patient-authorized coordination layer like this reflects real interoperability pain points,
        or if current EHR tools already address this.
    </p>

    <!-- Signature -->
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e8ebe3;">
        <p style="font-size: 15px; color: #374151; line-height: 1.4; margin: 0 0 4px;">Best,</p>
        <p style="font-size: 15px; color: #111827; font-weight: 600; line-height: 1.4; margin: 0 0 2px;">Lindsay Bachman</p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
            Clinical Informatics &mdash; University of Washington
        </p>
    </div>
    """
    return _wrap(body, email)
