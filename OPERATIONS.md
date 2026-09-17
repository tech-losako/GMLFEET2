# GM Fleet operations — applications and finance

## Staff access
Open `/admin`. Sign in with the existing `admin@losakoholding.cd` account.
Only active `staff_members` can read or manage cases, appointments, notes, private documents, vehicles, or existing payments. The initial membership is tied to the existing account by email during migration, never a browser-provided role.
Additional staff must first have a Supabase Auth account and be explicitly added to `staff_members` by a project administrator. Staff cannot grant themselves membership through the public API.

## Available workflows
- Unified website and office intake for four programs.
- Search, program/stage filters, assigned agent, next action and follow-up date.
- Separate LOLC decision/reference and operational stage.
- Appointments with a required pre-appointment briefing acknowledgment; statuses retain history.
- Internal append-only notes and database-generated activity history.
- Private staff document uploads, max 10 MiB, PDF/JPEG/PNG/WebP; short-lived signed download links.
- Preparation checklist and LOLC/handover database guards.
- Optimistic concurrency on case edits and appointment status changes.
- Automatic list refresh every minute when no form is open; manual refresh is available.

## Deliberate limits
This release covers intake, case management, contract activation, cashier-confirmed payments, and recorded weekly LOLC deposits. External provider collection, Araka, Yango, WhatsApp, OTP and mobile integration are not connected.
Public website file controls still submit filenames only. Staff can upload the actual files from the case dashboard.
The operations dashboard now includes Contracts & vehicles, Cashier/payments, and LOLC deposits. Existing vehicles and payments remain in the database. New money movements are accepted only through guarded transactional database functions.
LOLC approval does not activate a driver or start repayments. No automatic messages are sent.
Existing account-level leaked-password protection remains disabled in Supabase Auth.

## Validation
`tests/database.cjs` runs the migration against isolated PostgreSQL (PGlite), with Supabase Auth/Storage schema fixtures. It checks public submission, staff isolation, staff enrollment denial, LOLC/handover guards, appointment briefing, audit immutability, and private storage.
`tests/browser.cjs` uses a local server and mocked Supabase responses for desktop/mobile layout, search, form actions, document flow, timezone conversion, HTML escaping, and denied access. It does not authenticate against production or write production test data.

Install test-only packages separately from the static website, using PGlite 0.5.8 and Playwright 1.62.1. Set `PGLITE_MODULE` and `PLAYWRIGHT_MODULE` to their module locations when not installed in the usual Node resolution path. Browser tests default to installed Edge; `BROWSER_CHANNEL` can override the channel. Run:

    node tests/database.cjs
    node tests/browser.cjs

Migrations use the actual versions recorded by Supabase. Deploy the database migration before the dashboard. Do not reapply already recorded migrations.
## Contracts and finance
- Approve LOLC financing and mark the vehicle handed over before activating Drive to Own. Partner drivers must be approved/available.
- Enter the signed contract reference, vehicle/plate/VIN/tracker, currency, start/end/first-payment dates, operating weekdays, excluded dates, and separate daily LOLC/GML amounts. No repayment schedule is generated from an application date.
- Activation creates the driver, vehicle assignment history, immutable contract terms and schedule in one transaction. One active contract per driver/vehicle/application.
- Cashiers and admins confirm manual receipts themselves. An agent can view finance and activate contracts but cannot confirm payments or deposits.
- Receipt reference, reason, amount, method and received date are mandatory. Optional proof is private. Printable receipts include their recorded status.
- Payments allocate oldest instalments first, including advance payment of future instalments up to the remaining contractual total. Split each payment across the outstanding LOLC/GML components; decimal rounding clears both exactly on full payment.
- A reversal preserves the original receipt and creates negative allocations. Already-deposited LOLC receipts cannot be reversed through the cashier screen. They require an separately designed accounting adjustment process.
- Weekly reconciliation selects confirmed, non-reversed, not-yet-deposited receipts within a date range and single currency. The bank amount must exactly match selected LOLC shares. Bank reference and private proof are required. Deposit details list the included receipts. Recording a deposit does not execute a bank transfer and does not change driver balances.
- USD and CDF totals remain separate. No exchange-rate conversions or automatic penalties are assumed.
- An administrator can void an erroneous contract only after net receipts are zero. Its terms and assignment history remain stored. Full paid-contract completion, reassignment/renewal, owner earnings, settlements and scheduled contract amendments remain future workflow work.
- Real payment-provider callbacks are not implemented: a Mobile Money method here means a manually verified receipt, not an automated provider confirmation.
- Proof uploads are retained; a successful upload followed by a rejected financial form can leave an unlinked private file, to be handled by a future retention/cleanup policy.

## Finance validation
Run `node tests/finance-database.cjs` and `node tests/finance-browser.cjs` with the same module environment variables described above. The database tests execute real SQL on isolated PostgreSQL and cover retries, partial allocation/rounding, reversals, duplicate deposits, currency mismatch, anonymous/nonstaff denial, cash-role authorization, excluded dates and activation rollback. Browser tests cover the cashier flow with isolated fixtures, including a failed-save retry. They do not use staff credentials against production or create production test payments.
## Super Admin and staff accounts

The existing admin@losakoholding.cd account is now Super Admin. Open `/admin`, then **Utilisateurs**.
- Add a name, email and role. Copy the one-use setup link and share it privately with that person; the application does not send email automatically.
- Staff choose a password (minimum 12 characters) at `/set-password.html`, then sign in normally.
- Super Admin can edit roles, disable/reactivate accounts, and generate replacement invitation or password-reset links. A disabled account loses data access immediately because RLS checks active membership on every request.
- Agents manage cases and activate contracts. Cashiers also confirm/reverse receipts and reconcile LOLC deposits. Administrators additionally void eligible contracts. Only Super Admin manages users.
- Self-demotion/deactivation is blocked; staff changes are serialized, checked against a revision and recorded in `staff_events`. Staff directory emails and this audit are Super Admin only.
- Invitation tokens are generated by `staff-invite` (JWT plus live membership authorization) using the server-only service key. Links carry their token in a URL fragment; setup clears it from the address bar and uses an isolated in-memory auth session.
- No staff accounts were created during deployment. Browser/Edge tests use fixtures; database tests use isolated PostgreSQL. Authenticated production invitation acceptance still needs a real staff member's first use.

Verification: `tests/staff-database.cjs`, `tests/staff-browser.cjs`, `tests/staff-edge.cjs`; finance browser regression also passes. Set `PGLITE_MODULE` and `PLAYWRIGHT_MODULE` as for the existing test suite.

### Email editing and removal
- **Modifier** includes the login email. The `staff-email` Edge Function uses Auth Admin `updateUserById`; pending email operations can be retried. Another staff edit or deletion is blocked while an email operation is pending. Email and profile changes are separate operations; if the latter fails, the UI retains and reports the successful email change.
- **Supprimer** requires typing SUPPRIMER, rejects self-deletion, removes the staff entry from the management list and permanently revokes its staff access. This is a logical staff deletion: the Auth identity and records remain for transaction/audit references, and the email is not freed for a new identity. No destructive Auth deletion or record cascade is performed.
- Deleted entries cannot be reactivated through the normal staff RPC. Email operations and deletions are audited. Only the service role can finish an email operation, and completion checks the actual Auth email.
- Added tests cover deletion, no self-deletion, denied access after deletion, no resurrection, email validation, retry/concurrent mutation blocking, duplicate-email errors, and service-only finalization. No production accounts were changed during verification.

## Public application attachments
Public vehicle, Yango, fleet and recruitment forms submit real file bytes through submit-application. Supported: JPG, PNG, WebP and PDF; 10 MiB per file, 8 files / 20 MiB total. Convert Word and HEIC files before submitting.

The public Edge Function validates applicant fields, file signatures and size limits. Server-only RPCs reserve a stable application ID and atomically register the application and documents after every file exists in the private application-documents bucket. Retrying the same request reuses uploaded files and cannot duplicate the application. Editing the form starts a new submission. Interrupted uploads remain private and staged for retry. Abandoned staged objects and old submission manifests currently require administrative retention cleanup.

Staff open Candidatures, then the dossier and Documents privés for image previews and signed links to originals/PDFs. Public document rows use created_by=null. Public visitors cannot read document rows or storage. Previous submissions saved only filenames; missing file contents must be resent.

Tests cover atomicity, idempotency, access controls, multipart bytes, signatures, upload failures, all four program forms and actual admin image rendering. Production smoke checks use invalid submissions without creating applicant records.
