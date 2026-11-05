# Admin form draft recovery

Administrative forms now retain draft text, selections and selected files in the current tab. The sidebar **Brouillons** menu lists recoverable work. Staff can resume from that menu or reopen the same form and choose **Restaurer le brouillon**. Nothing is submitted automatically.

## Scope and storage

- Dossiers, new candidatures, vehicle handover/photos, appointments, contracts, cash payments, owner costs/repairs, inspections, SIM details and document upload/review forms use the shared recovery layer.
- Session Storage synchronously preserves the latest text. IndexedDB stores attachment blobs separately, so listing drafts does not load all vehicle photos into memory.
- Keys include staff account, tab, dossier, form and applicable contract/mandate/advance/document identifiers. A missing vehicle/contract selection cannot silently fall back to another person during restoration.
- Drafts expire after 24 hours and are removed on logout. Expired records are cleaned when the draft store is opened. They are local browser data and do not sync to another device or tab.
- Passwords, hidden tokens and secrets are excluded. Confirmation checkboxes are reset on recovery. Data that drives calculations is read again through existing form controllers.
- If file storage is unavailable, the text remains recoverable where Session Storage works, with a visible warning to reselect attachments. Refresh also warns when writes are pending or storage has failed.

## Submission safety

Successful server mutations explicitly clear drafts before subsequent UI refreshes or notifications. Clearing writes a synchronous tombstone while attachment cleanup completes, preventing a fast refresh from resurrecting a saved operation.

An interrupted submission is never replayed automatically. If such a draft is restored, submission is blocked and staff are directed to verify the dossier/history first. Existing in-page retry/idempotency behavior remains in place. Existing server validation, financial calculations and payment schedules are unchanged.

## Tests

- `tests/form-drafts-browser.cjs`: refresh, exact attachment bytes, programme fields, account/dossier isolation, secret exclusion, fresh confirmations, uncertain-submission protection, successful-save/discard/logout cleanup, expiry and file-storage failure.
- `tests/admin-draft-recovery-browser.cjs`: real admin intake reopening through the recovery menu and mobile layout.
- Existing service setup, client information, repairs and compact operations browser tests exercise integration with the shared layer.

Tests use local fixtures and do not send SMS or create real applications/payments.
