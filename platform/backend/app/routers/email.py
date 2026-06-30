import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import resend

from app.config import settings
from app.email_templates import welcome_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])


class SubscribeRequest(BaseModel):
    email: EmailStr
    name: str = ""
    role: str = "general"  # "patient", "clinician", "general"


class ContactRequest(BaseModel):
    email: EmailStr
    name: str
    subject: str
    message: str


@router.post("/subscribe")
def subscribe(req: SubscribeRequest):
    """
    Subscribe to LaunchFlow marketing emails.
    Sends a welcome email via Resend.
    """
    if not settings.RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email service not configured")

    resend.api_key = settings.RESEND_API_KEY

    try:
        html_body = welcome_email(name=req.name, role=req.role, email=req.email)

        params: resend.Emails.SendParams = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [req.email],
            "subject": "Welcome to LaunchFlow — Patient Health Data Agent",
            "html": html_body,
        }

        email_resp = resend.Emails.send(params)
        logger.info(f"Welcome email sent to {req.email}: {email_resp}")

        return {
            "status": "subscribed",
            "email": req.email,
            "message": "Welcome email sent successfully",
        }

    except Exception as exc:
        logger.error(f"Failed to send email to {req.email}: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(exc)}")


@router.post("/contact")
def contact(req: ContactRequest):
    """
    Send a contact/inquiry message via Resend.
    """
    if not settings.RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email service not configured")

    resend.api_key = settings.RESEND_API_KEY

    try:
        params: resend.Emails.SendParams = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": ["hi@businessintuitive.tech"],
            "reply_to": req.email,
            "subject": f"[LaunchFlow Contact] {req.subject}",
            "html": f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; padding: 20px;">
                <h2 style="color: #111827;">New Contact Message</h2>
                <p><strong>From:</strong> {req.name} ({req.email})</p>
                <p><strong>Subject:</strong> {req.subject}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb;" />
                <p style="color: #374151; line-height: 1.7;">{req.message}</p>
            </div>
            """,
        }

        email_resp = resend.Emails.send(params)
        logger.info(f"Contact email from {req.email}: {email_resp}")

        return {"status": "sent", "message": "Message sent successfully"}

    except Exception as exc:
        logger.error(f"Contact email failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(exc)}")


class InquireRequest(BaseModel):
    name: str
    email: EmailStr
    interest: str = ""   # e.g. "clinic", "research", "team", "investor"
    role: str = ""        # their self-described role
    message: str = ""


@router.post("/inquire")
def inquire(req: InquireRequest):
    """
    Inquiry / 'join the team' form — notifies hi@businessintuitive.tech.
    """
    if not settings.RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email service not configured")

    resend.api_key = settings.RESEND_API_KEY

    interest_label = {
        "clinic": "Clinic / Health System",
        "research": "Research / IRB",
        "team": "Join the Team",
        "investor": "Investor / Partner",
    }.get(req.interest, req.interest or "General")

    try:
        params: resend.Emails.SendParams = {
            "from": "CareOS <hi@businessintuitive.tech>",
            "to": ["hi@businessintuitive.tech"],
            "reply_to": req.email,
            "subject": f"[CareOS Inquiry] {interest_label} — {req.name}",
            "html": f"""
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
              <div style="background:#111;padding:28px 32px">
                <span style="display:inline-block;background:#c4ff4d;color:#111;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;border-radius:99px">CareOS Inquiry</span>
                <h1 style="margin:12px 0 0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px">{req.name}</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,.5);font-size:13px">{interest_label}</p>
              </div>
              <div style="padding:28px 32px">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="padding:8px 0;color:#6b7280;width:110px">Email</td><td style="padding:8px 0;color:#111"><a href="mailto:{req.email}" style="color:#4d80ff">{req.email}</a></td></tr>
                  <tr><td style="padding:8px 0;color:#6b7280">Interest</td><td style="padding:8px 0;color:#111">{interest_label}</td></tr>
                  {f'<tr><td style="padding:8px 0;color:#6b7280">Role</td><td style="padding:8px 0;color:#111">{req.role}</td></tr>' if req.role else ''}
                </table>
                {f'<hr style="border:none;border-top:1px solid #f3f4f6;margin:16px 0"><p style="color:#374151;font-size:14px;line-height:1.7;margin:0">{req.message}</p>' if req.message else ''}
              </div>
              <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#9ca3af">Sent from launchflow.tech · Reply goes directly to {req.email}</div>
            </div>
            """,
        }

        email_resp = resend.Emails.send(params)
        logger.info(f"Inquiry from {req.email} ({interest_label}): {email_resp}")

        return {"status": "sent", "message": "Inquiry received — we'll be in touch shortly."}

    except Exception as exc:
        logger.error(f"Inquiry email failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to send inquiry: {str(exc)}")
