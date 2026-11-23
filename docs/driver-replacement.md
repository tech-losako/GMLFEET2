# Driver returns and replacements

Administrators open Contracts, choose the active partner-driver contract, then
**Restitution / remplacer ce chauffeur**. Record the actual return date, reason,
inspection notes and whether the vehicle is available or needs maintenance.
Confirmation stops automated SMS and WhatsApp to the departed driver's number.

The return date is inclusive: existing service charges through that date remain.
Later unearned service charges become zero, preserving schedule IDs and an audited
snapshot of their previous values. Existing repair/advance instalments, payments,
allocations and original signed contract totals remain. Paid future instalments
block backdating until the cashier reconciles them. This does not forgive debt.

The old contract is marked ended. Its debt stays visible under Contracts and can
still be collected by the cashier as an old debt. Driver messages remain blocked;
boss alerts for confirmed receipts retain their existing rules. Already submitted
messages cannot be recalled. Private transport suppression also covers duplicate
files using the same normalized phone and SMS fallback messages.

The owner's mandate, original term and advances remain unchanged. The vehicle is
released without inventing a new driver. Register and approve the replacement as
Chauffeur partenaire, then activate their own contract on the available vehicle.
The service date must follow the previous driver's return. Managed-vehicle terms
remain USD 31, Monday–Friday, first payment on the next eligible weekday. Existing
assignment and contract notifications apply to the new driver and owner. No debt
is copied from the previous contract.

The return operation uses request_id idempotency, an admin-only RPC, RLS-protected
history, finance_events and audit_logs. Local verification:
`tests/driver-assignment-end-database.cjs` and
`tests/driver-assignment-end-browser.cjs`. Tests use fictional records and mocked
providers; they do not contact clients.
