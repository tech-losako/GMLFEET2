# GM Fleet operations — first release

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
This release covers intake and case management. It does not create active contracts, generate repayment obligations, collect payments, reconcile weekly LOLC deposits, or connect Yango/WhatsApp/OTP/mobile.
Public website file controls still submit filenames only. Staff can upload the actual files from the case dashboard.
The old basic fleet/payment screen is replaced by the operations dashboard; existing vehicles and payments remain in the database. Full contract, cashier payment, and reconciliation screens are the next release.
LOLC approval does not activate a driver or start repayments. No automatic messages are sent.
Existing account-level leaked-password protection remains disabled in Supabase Auth.

## Validation
`tests/database.cjs` runs the migration against isolated PostgreSQL (PGlite), with Supabase Auth/Storage schema fixtures. It checks public submission, staff isolation, staff enrollment denial, LOLC/handover guards, appointment briefing, audit immutability, and private storage.
`tests/browser.cjs` uses a local server and mocked Supabase responses for desktop/mobile layout, search, form actions, document flow, timezone conversion, HTML escaping, and denied access. It does not authenticate against production or write production test data.

Install test-only packages separately from the static website, using PGlite 0.5.8 and Playwright 1.62.1. Set `PGLITE_MODULE` and `PLAYWRIGHT_MODULE` to their module locations when not installed in the usual Node resolution path. Browser tests default to installed Edge; `BROWSER_CHANNEL` can override the channel. Run:

    node tests/database.cjs
    node tests/browser.cjs

Migrations use the actual versions recorded by Supabase. Deploy the database migration before the dashboard. Do not reapply already recorded migrations.