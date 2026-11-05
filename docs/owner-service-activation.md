# Managed owner service activation

The owner mandate remains separate from the driver's service contract. A mandate may wait for a driver. Service and the existing repayment schedule start only when that driver contract is activated.

## Staff flow

1. Complete the real owner/driver identity information and the vehicle record.
2. Record the initial fuel funding, documents and any repair. Existing repair reports can be selected in the repair wizard; a cost already attached to a repair is reused, never charged a second time. Staff must confirm that work has actually finished.
3. Sign the owner mandate, select the separately registered driver and vehicle, and choose the real start date.
4. Review the consolidated owner balance in the final activation step. Confirm that all known costs and deductions are included.

The server rejects new managed activations with incomplete legal fields, open repair reports or placeholder expense details. The final review fingerprint also rejects activation if the reviewed information or costs changed. Existing active contracts are not deactivated or rescheduled by deployment.

## Notifications

Each new activation queues one owner financial recap with the driver/vehicle, service date, owner target, all outstanding advances, one-time fees, repayment terms, total remaining and next projected deduction/net. The former per-advance activation messages are no longer queued. Driver notifications and owner month-end paid confirmations remain separate events.

Legal PDF copies use separate private SMS links. A failure to generate one party's PDF does not skip the other party. Missing information and SMS errors stay visible after saving; a general success message does not replace them. Provider acceptance remains distinct from confirmed delivery.

No historical activation messages are replayed by migration. New costs incurred during service remain dated records; deployment does not pretend those costs existed in an earlier contract review.

## Corrections and balances

`correct_vehicle_advance_details` changes the category, description, repair association and references only. It preserves principal, the one-time 15% fee, total, recoveries and instalments. Staff permissions, `request_id` replay checks and before/after audit records apply. It cannot transfer a driver debt onto an owner.

Active service status is derived from the actual contract and vehicle link. Historical candidature statuses are not rewritten to manufacture workflow events.

## Verification

- `tests/owner-service-activation-database.cjs`: legal/cost/repair gates, stale review rejection, transactional rollback, audited nonmonetary correction, preserved instalments, one owner recap and idempotent activation.
- `tests/service-setup-browser.cjs`: mobile wizard, required review, blocked activation, independent contract copies.
- `tests/client-information-browser.cjs`: simpler identity correction steps and existing authorization behavior.
- `tests/case-costs-repairs-browser.cjs`: fuel only once, repairs and external funding, retry/deduplication and driver debt isolation.
- Existing managed finance, SMS dispatch/provider and private contract-copy tests cover unchanged collection and delivery behavior.

All automated tests use local fixtures or mocked providers; they do not send client messages.
