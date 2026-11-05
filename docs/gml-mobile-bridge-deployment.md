# GML Mobile bridge — deployment

Implements contract v1, sections 2–5. Finance commands, triggers and stored amounts are unchanged.

## Shared secret

Set **`GML_BRIDGE_SECRET`** in GM Fleet → Supabase → Edge Functions → Secrets. Set the **same value** as **`GMFLEET_BRIDGE_SECRET`** in GML Mobile. Generate at least 32 random bytes (64 hexadecimal characters is a convenient encoding). Never put the value in Git, the browser, a mobile build or this document.

GML Mobile also needs **`GMFLEET_BRIDGE_URL`** = `https://poskrhgqwezjuexbwosc.supabase.co/functions/v1/gml-mobile-bridge`.

The bridge deliberately rejects all requests until this secret is configured. Its five actions require HMAC signatures over the exact request body. The GML Mobile backend must authenticate the user and obtain the OTP-verified phone itself; it must not forward a user-selected account id or an unverified phone.

## Invitation privacy

The migration creates exactly the three public tables in the contract. A private pepper is generated in the existing private SMS configuration. The invite code is derived privately from a random invite UUID and that pepper; the invite stores only `sha256(pepper || code)`. Codes are not returned to the browser, stored in the SMS body or included in audit logs. The worker resolves the message through the service-only `mobile_owner_invite_sms` RPC at send time, including retries. Keep the pepper stable; rotating it invalidates pending invites.

The existing SMS transport must be enabled and configured for invitation delivery. An invitation's creation is not a delivery confirmation. Check the existing SMS delivery journal for delivery status.

## Lockout and access

For an unknown 8-digit code, the invite cannot be found by hash. Failures are therefore counted against open, unexpired invites for the **backend-verified phone**. Five attempts lock those invites. A matching code with a different phone increments the matching invite's attempts. Malformed code strings return `bad_request` and cannot redeem anything. A replacement invitation revokes the old open one. Redeeming a used code is idempotent only for the original user and phone while their link remains active; it never restores revoked access.

Rate limiting is transactional and shared across edge instances through the indexed, append-only event log, with an advisory lock per account. There is no financial cache.

`current_month` reads the persisted cashier schedules and net allocations; receipts use the same signed base collection rule as `private.owner_period_collections`, excluding driver advance recoveries. No dedicated reasoned excused-day record exists, so `excused_days` is `[]` as allowed by the contract. Excluded dates remain absent from schedules. The receipt's actual calendar date is retained, including Saturday regularisation.

## Verification

- `node tests/gml-mobile-bridge-database.cjs`: contract cases 1–6 and 8–10, permissions, idempotency, append-only logging and rate limits.
- `node tests/gml-mobile-bridge-edge.cjs`: case 7, real HMAC verification and request allowlists.
- `node tests/mobile-owner-access-browser.cjs`: owner controls and role visibility.
- `node tests/sms-delivery-edge.cjs`: existing SMS transport regression.
- `node tests/connected-fleet-finance-database.cjs`: existing finance regression.

All tests use local fixtures or mocked providers. They do not send SMS or create real owner accounts. Section 6 of the contract remains the responsibility of the separate GML Mobile repository.
