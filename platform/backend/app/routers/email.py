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
            "to": ["team@launchflow.tech"],
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
