# GM Fleet ↔ GML Mobile — owner bridge (contract v1)

Status: agreed design, 5 Nov 2026. GM Fleet builds sections 2–5 (Codex, repo `GMLFEET2`). GML Mobile builds section 6 (repo `tracking-gml`). Both sides test against section 7.

This extends `docs/gml-mobile-owner-access-proposal.fr.md`; read that first.

## 1. Principles

- **GM Fleet stays the only source of truth** for owner files, vehicles, mandates, drivers, receipts, advances and owner settlements. GML Mobile never writes any of it and never keeps a copy of the money. It reads through this bridge when the owner opens a screen.
- **Access is per owner file.** A GML Mobile account can only see the vehicles of the GM Fleet owner files it has been linked to. Name, plate or a typed phone number are never enough to claim a vehicle.
- **Linking needs two proofs:**
  1. a one-time invite code that GM Fleet staff send to the owner's phone on file;
  2. the same phone number verified by GML Mobile (WhatsApp OTP) on the account that redeems it.
- **Server to server only.** GML Mobile's backend calls one GM Fleet edge function with a shared secret. No GM Fleet key ever reaches a phone. GML Mobile never receives GM Fleet's service-role key.
- **Read-only, minimal fields.** Owners see their own figures. They never see receipt proofs, private documents, staff identities, driver ID documents or other owners' data.
- No password is ever sent by SMS. No historical data is invented by deployment.

## 2. GM Fleet tables

```sql
-- One active invite per owner file; a new invite revokes the previous one.
create table public.mobile_owner_invites (
  id uuid primary key default gen_random_uuid(),
  owner_application_id bigint not null references public.applications(id),
  phone text not null,                       -- normalised owner phone at invite time
  code_hash text not null,                   -- sha256(pepper || code); the code itself is never stored
  expires_at timestamptz not null,           -- created_at + 72 hours
  failed_attempts int not null default 0,    -- locked at 5
  redeemed_at timestamptz,
  redeemed_gml_user_id uuid,
  revoked_at timestamptz,
  created_by uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now()
);
create unique index mobile_owner_invite_open on public.mobile_owner_invites(owner_application_id)
  where redeemed_at is null and revoked_at is null;

-- Who may read what. One GML account may hold several owner files
-- (GM Fleet has one owner file per vehicle).
create table public.mobile_owner_links (
  id uuid primary key default gen_random_uuid(),
  owner_application_id bigint not null references public.applications(id),
  gml_user_id uuid not null,                 -- GML Mobile auth user id (other project, no FK)
  gml_phone text not null,                   -- phone verified by GML at redemption
  invite_id uuid not null references public.mobile_owner_invites(id),
  linked_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.staff_members(user_id),
  revoke_reason text
);
create unique index mobile_owner_link_active on public.mobile_owner_links(owner_application_id, gml_user_id)
  where revoked_at is null;

-- Append-only log of every bridge call.
create table public.mobile_bridge_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  gml_user_id uuid,
  owner_application_id bigint,
  vehicle_id bigint,
  outcome text not null                      -- 'ok' or the error code
);
```

All three tables: RLS on. Staff (`private.is_staff()`) can read invites and links; the bridge log is read-only for admins. There are no client write policies. Writes go only through the functions below and the edge function, using the service role inside GM Fleet.

## 3. Staff commands (GM Fleet admin)

- **`create_mobile_owner_invite({application_id, request_id})`**
  - Role: agent, cashier or admin.
  - Only for `program_type = 'FLEET_OWNER'` files with a phone.
  - Revokes any open invite, then generates an 8-digit code (shown as `1234-5678`) and stores its hash with a 72 h expiry.
  - Queues an SMS via `private.queue_sms('mobile_invite:'||invite_id, 'mobile_owner_invite', phone, ...)`:
    > GM Fleet : votre code d'accès GML Mobile est 1234-5678. Ouvrez GML Mobile > Propriétaire > Voitures et saisissez-le. Valable 72 h. Ne le communiquez à personne.
  - Returns `{invite_id, expires_at, phone_masked}`. The code is never returned to the browser.
- **`revoke_mobile_owner_link({link_id, reason, request_id})`**
  - Role: admin.
  - The reason must be at least 5 characters. Access stops immediately.
- **Admin UI on the owner file:**
  - an "Inviter sur GML Mobile" button;
  - the state of the latest invite (sent / expired / used);
  - the list of active links (phone, date) with "Retirer l'accès".
- Idempotent with `request_id`, like the other GM Fleet commands. Everything is recorded in `audit_logs`.

## 4. Edge function `gml-mobile-bridge` (GM Fleet)

`POST https://<gmfleet-project>.supabase.co/functions/v1/gml-mobile-bridge`

`verify_jwt = false`: authentication is the shared secret below.

### Request authentication

The headers are:

| Header | Value |
|---|---|
| `x-gml-bridge-version` | `1` |
| `x-gml-timestamp` | Unix seconds |
| `x-gml-signature` | hex HMAC-SHA256 of `timestamp + "." + rawBody`, keyed with the shared secret |

Rules:
- The secret is stored as `GML_BRIDGE_SECRET` in GM Fleet and as `GMFLEET_BRIDGE_SECRET` in GML. It is at least 32 random bytes.
- Reject with 401 `bad_signature` if the signature is wrong (constant-time compare) or the timestamp is more than 300 s from now.
- Rate limit: 120 calls per minute per `gml_user_id`. Over the limit, return 429 `rate_limited`.

Body: `{"action": "...", "gml_user_id": "<uuid>", ...}`. Every response is JSON. Errors use `{"error": "<code>", "message": "<French text for the owner>"}` with status 400/401/403/404/409/429.

Every action except `redeem_invite`:
- resolves the active links for `gml_user_id`;
- answers 403 `not_linked` when there are none;
- answers 404 `vehicle_not_found` when a `vehicle_id` is not owned by one of the linked owner files.

Every call writes one `mobile_bridge_events` row.

Amounts are numbers in USD with 2 decimals. Dates are `YYYY-MM-DD` (Africa/Kinshasa); timestamps are ISO-8601 UTC.

### 4.1 `redeem_invite`

Request: `{"action":"redeem_invite","gml_user_id":"…","gml_phone":"+243812345678","code":"12345678"}`. `gml_phone` is the phone GML verified by OTP for this account.

Checks:
1. Find the open, unexpired invite whose `code_hash` matches. Otherwise return `invalid_code`; when the code matches an expired invite, return `expired`.
2. `normalize(gml_phone) = invite.phone`. Otherwise return `phone_mismatch` and count a failed attempt.
3. Five failed attempts lock the invite and return `too_many_attempts`.

On success, in one transaction: mark the invite redeemed, create the link, and queue the SMS "GM Fleet : votre accès GML Mobile est activé." to the owner phone.

Response 200:
```json
{"linked": true, "owner_application_id": 812, "owner_name": "Mme X", "vehicles": 1}
```
Redeeming the same code again with the same user returns the same success. With another user, it returns `invalid_code`.

### 4.2 `owner_overview`

Request: `{"action":"owner_overview","gml_user_id":"…"}`

Response 200:
```json
{
  "owner": {"name": "Mme X", "phone_masked": "+243 81•• ••• 678"},
  "vehicles": [{
    "vehicle_id": 341,
    "owner_application_id": 812,
    "plate": "1234AB01",
    "model": "Toyota Corolla",
    "status": "active",
    "mandate": {
      "reference": "GMF-M-2026-0012", "status": "active", "category": "A",
      "owner_target": 500.00, "management_fee": 64.00, "progression_reserve": 44.00,
      "effective_start": "2026-10-06", "effective_end": "2027-10-05"
    },
    "driver": {"name": "Jean K.", "since": "2026-10-06"},
    "equipment": {"package": "tracker_camera", "tracker_id": "8680…", "dashcam_id": "…"},
    "current_month": {
      "period_start": "2026-11-01",
      "collected_to_date": 279.00,
      "working_days_due_to_date": 9,
      "days_paid": 9,
      "excused_days": [{"date": "2026-11-03", "reason": "sick_with_proof"}],
      "outstanding_to_date": 0.00
    },
    "recap": {
      "next_period": "2026-11-01", "next_payout_date": "2026-11-30",
      "owner_target": 500.00, "next_deduction": 40.00, "projected_net": 460.00,
      "debt_remaining": 120.00
    },
    "last_settlement": {"period_start": "2026-10-01", "owner_net": 460.00, "paid_on": "2026-11-03"}
  }]
}
```
Notes:
- `driver.name` is first name plus initial only; no driver phone or documents.
- `equipment` comes from `vehicles.tracker_id` and the case `preparation->equipment`; `null` when nothing is installed.
- `current_month` uses the same rules as the cashier screen:
  - Monday–Friday collection, from the assignment start date;
  - Saturday régularisation receipts count;
  - days excused for sickness with a certificate, or for an immobilisation not caused by the driver, are listed and not due.
  - If GM Fleet does not yet record excused days, return `"excused_days": []`.
- `recap` is `private.owner_financial_recap(owner_application_id)` mapped as shown.

### 4.3 `vehicle_settlements`

Request: `{"action":"vehicle_settlements","gml_user_id":"…","vehicle_id":341,"limit":24}`

Returns `owner_settlements` for that vehicle's mandates, newest first:
```json
{"settlements": [{
  "id": "…", "period_start": "2026-10-01", "period_end": "2026-10-31",
  "base_collected": 682.00, "owner_gross": 500.00, "management_fee": 64.00,
  "progression_reserve": 44.00, "cash_reserve": 74.00, "recovered": 40.00, "owner_net": 460.00,
  "adjustment_reason": null, "payment_reference": "MP261103.1542", "paid_on": "2026-11-03"
}]}
```

### 4.4 `vehicle_receipts`

Request: `{"action":"vehicle_receipts","gml_user_id":"…","vehicle_id":341,"month":"2026-11"}`

Returns the confirmed driver receipts for that vehicle in the month, with reversals as negative lines:
```json
{"receipts": [{"date": "2026-11-04", "amount": 31.00, "method": "mobile_money", "kind": "payment"}]}
```
Excluded: proof files, transaction fees, cashier identity, LOLC split, and driver repair recoveries (these are not owner money).

### 4.5 `vehicle_advances`

Request: `{"action":"vehicle_advances","gml_user_id":"…","vehicle_id":341}`

Returns the owner advances (`debtor = 'owner'`) of the vehicle's owner file. These are the same fields as in `owner_financial_recap.advances`: description, principal, fee, total, remaining, months, recovery_start, recovery_deadline, next_deduction.

### 4.6 Errors

| Code | When |
|---|---|
| `bad_signature` | signature or timestamp invalid |
| `bad_request` | missing or invalid field |
| `invalid_code`, `expired`, `phone_mismatch`, `too_many_attempts` | redeem |
| `not_linked` | no active link for this GML user |
| `vehicle_not_found` | vehicle not in the user's linked owner files |
| `rate_limited` | over 120 calls per minute per user |

## 5. What GM Fleet must not do

- Never return the code, the code hash, staff names, proof paths, private documents or another owner's data.
- Never accept writes from the bridge other than redeeming an invite.
- Never trust `gml_phone` alone without a valid invite code.

## 6. GML Mobile side (for reference)

- **Secrets:** `GMFLEET_BRIDGE_URL`, `GMFLEET_BRIDGE_SECRET`.
- **Edge function `gmfleet-owner`.** It:
  - checks the user's GML session;
  - reads the user's OTP-verified phone from GML;
  - signs the request (section 4) and forwards only the actions above;
  - returns GM Fleet's JSON unchanged;
  - caches nothing financial.
- **Propriétaire space:**
  - the owner chooses **Camions (GML)** or **Voitures (GM Fleet · Yango)**;
  - the car screens mirror the truck screens: home figures, vehicle list, vehicle detail with live tracker/dashcam, monthly settlements, advances, receipts of the month.
- **First access:** WhatsApp OTP on the phone, then "Saisir mon code d'accès GM Fleet" → `redeem_invite`.
- **Tracker:** GML matches `equipment.tracker_id` / `dashcam_id` to its WhatsGPS devices for live position and video.
- **Yango earnings** are added later on the GM Fleet side and exposed through a new action; the GML screens already reserve the space.

## 7. Test cases (both sides)

1. A valid code and matching phone link the account; `owner_overview` then returns only that owner's vehicles.
2. A wrong code 5 times locks the invite (`too_many_attempts`). A new invite from staff works.
3. A right code with a different phone returns `phone_mismatch`; nothing is linked.
4. An expired code (72 h) returns `expired`.
5. A user linked to owner A asking for owner B's `vehicle_id` gets `vehicle_not_found`.
6. After staff revoke the link, the next call returns `not_linked`.
7. A bad signature, or a timestamp 10 minutes old, returns `bad_signature`.
8. `vehicle_settlements` figures equal the `owner_settlements` rows exactly (`owner_net = owner_gross − recovered`).
9. A reversed receipt appears as a negative line, and `collected_to_date` matches the cashier screen.
10. No response contains proof paths, staff ids or the invite code.
