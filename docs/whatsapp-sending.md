# GM Fleet — sending WhatsApp (brief for Codex)

Decided 6 November 2026 (Benito): GM Fleet sends from the **same WhatsApp Business number
as GML**. The French templates in `whatsapp-templates.fr.json` are **approved in Meta**.
Read with `whatsapp-setup.md` (rules) and `whatsapp-notification-coverage.fr.md` (who gets what).

## How the pieces fit

- **Sending:** GM Fleet calls the Meta Graph API directly
  (`POST /{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages`, type `template`, language `fr`).
- **Delivery receipts:** Meta has one webhook per app; it is GML's (`whatsapp-webhook`).
  GML now forwards every receipt that is not for a GML message to GM Fleet through the
  existing signed bridge, so GM Fleet must **not** register its own Meta webhook.
- **Replies** from drivers/owners land in the GML admin WhatsApp inbox (same number).
  Templates must therefore never ask people to "reply to this message"; point to the
  GM Fleet phone/agent instead.

## Secrets (GMLFEET2 → Edge Functions → Secrets)

Only these are needed (no `WHATSAPP_APP_SECRET`, no `WHATSAPP_VERIFY_TOKEN`: GM Fleet has no webhook):

| Name | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | A Meta **system-user token** with `whatsapp_business_messaging` on GML's WABA. Prefer a second token made for GM Fleet (revocable on its own) over reusing GML's. |
| `WHATSAPP_PHONE_NUMBER_ID` | Same Phone Number ID as GML |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Same WABA ID as GML |
| `WHATSAPP_GRAPH_VERSION` | Same version as GML's configuration (`vXX.X`) |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `fr` |
| `WHATSAPP_ENABLED` | `false` until the test below passes |

## 1. Receive receipts from GML (bridge)

Add action `whatsapp_status` to `gml-mobile-bridge`, same HMAC verification and timestamp
window as the other actions (direction GML → GM Fleet, secret `GML_BRIDGE_SECRET`).

Body:
```json
{ "action": "whatsapp_status",
  "statuses": [ { "wamid": "wamid.HBg…", "status": "sent|delivered|read|failed",
                  "at": "2026-11-06T10:00:00.000Z", "recipient": "243…",
                  "error_code": 131026, "error_title": "…" } ] }
```

- Look up each `wamid` in GM Fleet's message log; unknown `wamid` → ignore (it may be a
  receipt for another app). Never create rows from this call.
- Update status monotonically (sent → delivered → read; failed is final). Reply
  `{ "ok": true, "updated": n }` quickly (GML waits at most 4 s).

## 2. Sending

- One server-side sender (e.g. extend `sms-dispatch` into a channel-aware dispatcher, or a
  new `whatsapp-dispatch` worker) reading the same queue pattern as `sms_dispatches`:
  pending → sending → sent/failed, `event_key` unique, `channel` = `whatsapp|sms`.
- Map each event to its template and parameters exactly as in `whatsapp-templates.fr.json`;
  parameters come from recorded data, never from the examples.
- Store the returned `wamid` and Meta error code. Respect `WHATSAPP_ENABLED` and the
  existing pause switch.
- Phone format: E.164 without `+` for Meta (`243…`).

## 3. Channel rules

- **One channel per event, no double sending by default.** WhatsApp first for template
  events; if Meta refuses the send, or a `failed` receipt arrives, send the SMS version once
  (same `event_key` + `:sms`). No resend on unknown state.
- **Debt collection / overdue money stays SMS only** (WhatsApp policy, see setup doc).
- Respect opt-outs and the appointment notification choice already stored.
- Driver payment reminders (`driver-payment-reminders.md`): the approved
  `gml_rappel_versement_fr` has **no link variable**. Either send the reminder by SMS (with
  the payment link) or submit a new template version with a URL button (`{{1}}` = link
  token) and use WhatsApp only once that version is approved.

## Done when

- Test to one authorised number: template delivered, receipt relayed by GML marks it
  delivered, then read; a forced failure (invalid number) produces exactly one SMS.
- No GM Fleet message ever appears twice; unknown receipts are ignored.
- Then set `WHATSAPP_ENABLED=true`.


## Implementation — 6 November 2026

The database and Edge functions are deployed. Website controls live in the message tracking page (WhatsApp details): configuration health, recipient permission, own-staff-number test, channel and read status. Existing finance calculations are unchanged.

- `sms-dispatch` and the shared `sms.ts` adapter choose one persisted channel. The 27 current event templates are verified against Meta approval, French language and exact catalogue body before use. Proposed events are not activated just because they appear in the pack.
- Private snapshots use recorded event data. Missing parameters or unapproved templates retain SMS. Explicit WhatsApp permission is recorded separately from a one-off test authorization.
- `gml-mobile-bridge` accepts signed `whatsapp_status` without `gml_user_id`. Unknown IDs and mismatched recipients are ignored. Sent → delivered → read is monotonic; a confirmed failure is final and creates one SMS fallback. No external send is performed inside the receipt request.
- A timeout, 5xx, malformed provider response or uncertain write is held for review, never retried automatically. Failed WhatsApp rows cannot be retried through the SMS retry button.
- Private contract/account links are encrypted at rest for SMS fallback, using a domain-separated key derived from the existing bridge secret. They are never written to public message bodies. Expired private links require renewal.
- Tests use an explicitly authorized number. The forced-failure test deliberately requests an invalid template on that same authorized number, rather than contacting an unrelated or invented number. Exactly one SMS fallback is queued after Meta's definite refusal.
- Global pause and appointment notification choices apply. Driver payment reminders, overdue collection, account recovery and GML Mobile invitation codes retain their existing SMS flow.

Validation: `tests/whatsapp-dispatch-database.cjs`, `tests/whatsapp-sending-edge.cjs`, `tests/gml-mobile-bridge-edge.cjs`, `tests/sms-delivery-edge.cjs`, `tests/appointment-sms-function.cjs`, `tests/driver-payment-reminders-edge.cjs`, `tests/sms-admin-browser.cjs`. Tests mock provider calls; no live messages are sent by them.

Live verification remains pending: `WHATSAPP_GRAPH_VERSION` is invalid/missing in GM Fleet's saved configuration. French language is set and `WHATSAPP_ENABLED=false`. The authorized recipient is +243837959472; no test has yet been sent. A real read receipt relayed by GML and one accepted SMS fallback are required before normal WhatsApp traffic is enabled. The database enforces this gate as well as the environment flag.


### Live check — 7 November 2026

All required secrets are configured; Meta approved bodies match for 25 templates. `gml_candidature_recue_fr` has a different body and is kept on SMS until reconciled; no template was edited in Meta. Technical tests now use the verified `gml_devis_recu_fr`, explicitly labelled TEST TECHNIQUE, without creating a real equipment request.

The authorized recipient +243837959472 confirmed receiving and opening the WhatsApp test. GM Fleet still has no delivered/read receipt for that WAMID through GML, so general WhatsApp sending remains disabled. The forced invalid-template send returned Meta code 132001 and created exactly one SMS fallback. A test-only validation bug cancelled that child before submission; it was corrected and only the same never-submitted child was resumed. Tests now assert fallback children bypass WhatsApp template validation. Test dispatch is ID-scoped (`whatsapp-test-send`) and cannot sweep unrelated pending messages.

Remaining integration check on GML: its existing WhatsApp webhook must forward this message's status using the signed `whatsapp_status` action described above. Do not manually mark messages read in GM Fleet, and do not register another Meta webhook.
