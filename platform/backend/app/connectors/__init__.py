"""
Fulfillment Routing Connector Framework.

Connectors are stub adapters that simulate sending fulfillment tasks
(lab orders, prescriptions, referrals, insurance packets) to external
systems. Each connector implements the BaseConnector interface.

Real integrations (Epic, eRx, etc.) would replace these stubs.
"""
from app.connectors.base import BaseConnector, SendResult
from app.connectors.router import route_task

__all__ = ["BaseConnector", "SendResult", "route_task"]
