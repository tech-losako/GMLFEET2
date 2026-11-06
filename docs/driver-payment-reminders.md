# Driver payment reminders (brief for Codex)

Requested by Benito, 6 November 2026. Build in GM Fleet (GMLFEET2). Reuse what exists:
the SMS queue (`sms_dispatches` + `sms-dispatch` worker, Africa's Talking), the driver
payment page (`payer.html` + `araka-payments`, actions `driver-lookup`, `context`, `pay`),
the contract calendar already used for "Retard selon le calendrier réel", and the
proposed WhatsApp template `gml_rappel_versement_fr` (#30 in the template pack).

## Goal

Remind every active driver, before the money is due, how much to pay and give a link to pay
digitally. Two programmes, two rhythms.

### 1. Fleet management cars (PARTNER_DRIVER on a managed owner car)

- Rule (contract): $31 per working day, Monday–Friday. Not due on an excused day
  (sick with proof within 48 h, breakdown without repair agreement). Missed or short amounts
  are paid on Saturday before the driver works for himself.
- **Send every working day at 18:00 Kinshasa**, only if today's amount is not yet fully
  recorded (cash or verified digital), the day is not excused, and the contract is active.
  Deadline stated in the message: **21:00 today**.
- Amount = today's unpaid part + any earlier unpaid balance (state both).
- **Saturday 08:00**: if a balance is still open from the week, one reminder with the
  total to settle before working for himself.

### 2. Drive to own (DRIVE_TO_OWN)

- **Send the day before each weekly due date at 18:00 Kinshasa** (after the 6th working day
  of the cycle / the day before the contractual weekly payment), with the full amount due
  tomorrow = weekly instalment + any arrears (state both) + the due date.
- If tomorrow is not a collection day, send the day before the actual due date.

## Message (SMS now; WhatsApp only after Meta approves the template)

Keep under 2 SMS segments. French. Example, fleet management:

```
GM Fleet : bonjour {prénom}, votre versement du jour ({date}) est de {montant} USD{, dont {arriéré} USD d'arriéré}. À régler avant 21h. Payer en ligne : {lien}
```

Drive to own:

```
GM Fleet : bonjour {prénom}, votre paiement hebdomadaire de {montant} USD{, dont {arriéré} USD d'arriéré} est dû demain {date}. Préparez le montant complet. Payer en ligne : {lien}
```

- WhatsApp policy (see `whatsapp-notification-coverage.fr.md`): reminders **before** the due
  date may be submitted as a utility template (`gml_rappel_versement_fr`, add the link as a
  button/variable). Anything about **overdue** money stays SMS only.

## Payment link

- Personal, short, no login: opens `payer.html` already on this driver's contract with the
  amount pre-filled (driver can still pay a different amount if allowed today).
- Single-purpose token tied to the contract, expires after 48 h, cannot read anything except
  that driver's payment context. Reuse the existing driver access mechanism
  (`issue_driver_plate_access` / `driver-lookup`) rather than a new one.
- Never put the phone number, name or amount in the URL.

## Rules

- Idempotent: one reminder per driver per due date per kind (`event_key` like
  `pay_reminder:{contract}:{date}`); re-running the job never double-sends.
- Recheck "already paid" immediately before sending (payment may arrive between 17:59 and 18:00).
- Skip: suspended/ended contracts, excused days, drivers without a valid +243 number,
  numbers opted out.
- Respect the existing SMS pause switch (`config.enabled`).
- Times are Africa/Kinshasa (UTC+1); schedule the jobs in UTC accordingly.

## Admin

- New section "Rappels de paiement": on/off per programme, send time, today's list
  (who will get one, amount, why skipped), last 7 days with SMS status, and a "send test to
  my number" button.
- Staff can pause reminders for one driver (with a reason).

## Done when

- Tested on staging data: a paid day sends nothing; an unpaid day sends one SMS with the right
  amount and a working link; an excused day sends nothing; Saturday catch-up shows the week's
  balance; DTO reminder arrives the evening before the weekly due date.
- No duplicate on re-run. The link expires after 48 h.

Not in scope: changing amounts or contract rules, overdue/collection messages on WhatsApp.


## Implementation — 6 November 2026

The brief above is implemented in `driver-payment-reminders.js`, the private migration
`20261106095452_driver_payment_reminders.sql`, the existing `sms-dispatch` worker and
`_shared/driver-payment-reminders.ts`.

### Administration

Open **Paramètres → Rappels de paiement**, or **Administration → Rappels de paiement**.
Administrators and super administrators can see today's recipients/skips, change each
programme's enable switch and send time, inspect the last seven days, pause an individual
driver with a recorded reason, register a number's opt-out and send an example only to
their own stored staff number. History is displayed incrementally in groups of 50.
Changes use request IDs and the existing audit/finance event journals; they do not move money.

Both programme switches initially allow reminders, subject to the existing global SMS
switch. Default times remain 18:00 Kinshasa (17:00 UTC), and Saturday 08:00 Kinshasa
(07:00 UTC). The minute-based scheduler evaluates the configured local times explicitly,
so changing a setting does not require editing the cron schedule. A delayed daily reminder
is cancelled at 21:00; a delayed Saturday reminder is cancelled at noon; a weekly reminder
never goes out after its pre-due calendar day. Dispatch is performed by the existing SMS
worker, not by the browser.

### Calendar and exclusions

Amounts come from repayment rows minus signed payment allocations: verified cash and
digital payments both count, as do their reversals. Repair additions already included in
GML repayment rows are retained. No rates, fee splits, repayment rows or contract dates are
changed. Saturday shows this week's unpaid amount plus older arrears. Weekly due dates
use the existing Sunday settlement rule, not an invented collection date.

The production audit found two Drive to Own contracts with **daily** cadence. They are
listed as incompatible with the requested weekly reminder and are not silently changed.
Recorded `excluded_dates` are respected. This feature does not adjudicate illness,
proof submission within 48 hours or breakdown eligibility, and does not create an excuse
or waive a contractual debt. Staff must record exclusions through the existing contract
process; pausing reminders alone does not excuse a payment.

### Queue and payment access

A reminder's event key is `pay_reminder:{contract}:{due_date}:{kind}`. The queue also enforces
one linked reminder per driver, due date and kind, including across contract replacement.
Existing accepted/unknown attempts are never automatically resent. The worker atomically
claims the SMS and rereads payments, contract/driver status, settings, phone and opt-outs
immediately before dispatch. A payment recorded before that final read cancels a reminder
that is no longer due. A payment recorded after the provider call cannot recall an SMS
already in transit.

The short route is `/p#token=...`, served by the existing `payer.html`. It reuses
`private.driver_plate_access`, scoped to the current contract, normalized phone and plate.
Only a cryptographic token hash is saved; the SMS body and raw capability are not stored
in the dispatch journal. Each reminder capability expires 48 hours after preparation.
The URL contains no name, phone or amount. The existing payment-context authorization
remains in force. Suggested amounts are recalculated from live balances and capped by the
remaining contract balance. The page never initiates a debit automatically and shows an
already-paid notice instead of suggesting the reminder amount again.

Messages are ASCII French, checked against the 306-character two-segment GSM limit,
and contain the current amount, arrears, total and link. All reminders stay **SMS only**;
no WhatsApp collection flow or template is enabled.

### Validation

- `node tests/driver-payment-reminders-database.cjs`: actual SQL migration with isolated
  PostgreSQL fixtures; paid/partial/excused days, repairs, Saturday, weekly cadence,
  timezone boundaries, duplicate jobs, pauses, opt-outs, late-payment cancellation,
  reversals, scoped 48-hour links, expiry and authorization.
- `node tests/driver-payment-reminders-edge.cjs`: provider mocked; text length,
  current/arrears split, random token/hash separation, atomic claims, cancellation and
  fail-closed database errors. No real SMS sent.
- `node tests/driver-payment-reminders-browser.cjs`: admin controls and mobile layout,
  own-number test request, payment-link prefill, paid reminders and no automatic debit.
- Existing SMS Edge, weekly-payment and admin-workspace regression checks remain applicable.


### Production verification

The migration and SMS worker version 6 are deployed. Both programme switches and the
existing SMS switch are enabled. The live preview identifies the managed driver's
31 USD for 6 November, the two daily-cadence DTO contracts as skipped, and no weekly
collection on 7 November for the weekly contract. No reminder was queued or test SMS
sent during deployment. The authenticated service endpoint rejects unauthenticated
reminder-test requests (HTTP 401); public/authenticated database roles cannot prepare
payment capabilities. Production cron is active.
