"""
Relay storage models — separate from the patient-portal schema in
`app/models.py`. Holds raw inbound messages and extracted FHIR resources
for later reconciliation against the patient-portal Patient records.

Two tables:
  - relay_inbound_messages: one row per HL7/FHIR message accepted by a listener.
                             Full body is envelope-encrypted at rest.
  - relay_fhir_resources:    extracted FHIR resources per message.

Keeping these separate from the operational schema lets us:
  * replay raw payloads if a transform changes
  * audit/forensics on what arrived vs. what was operationalised
  * grant the relay DB role narrower INSERT-only privileges on its own tables
"""

from .models import RelayFhirResource, RelayInboundMessage

__all__ = ["RelayFhirResource", "RelayInboundMessage"]
