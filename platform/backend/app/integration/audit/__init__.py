"""
Tamper-evident audit log for PHI access (HIPAA §164.312(b)).

Each `AuditEntry` row carries:
  - the action (read, write, transform, route, deliver, ack)
  - actor (service or human)
  - resource fingerprint (type + id + content hash)
  - hash_prev: SHA-256 hash of the row immediately preceding this one
  - hash_self: SHA-256 hash of this row's canonical content

Because each row's hash depends on the previous row's hash, any silent
modification or deletion in the middle of the log breaks the chain and can
be detected by `verify_chain()`.

Logs are append-only by convention — there is no UPDATE/DELETE API in this
module, and the DB role used by the relay should have INSERT-only privilege
on this table in production.

Submodules are imported explicitly by callers — this `__init__` is kept
empty so importing `app.integration.audit._hash` (pure stdlib) doesn't
drag in the SQLAlchemy-bound `models` / `recorder` modules. That keeps the
chain math testable / auditable from environments without our ORM stack.
"""
