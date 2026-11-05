# Admin workspace — 5 November 2026

- Daily navigation: À faire, Versements, Rendez-vous. Dossiers, Flotte, Finances and Administration are separate groups. Propriétaires and Chauffeurs have searchable directories linking to the same authoritative dossiers.
- Phone navigation has five fixed bottom actions. Menu opens the full navigation, including drafts and logout; selecting a page closes it.
- The dashboard has one action list: up to five collection priorities and appointments, programme/stage counts, digital payments to verify, contracts ending within 30 days and notification failures. Other payments and appointments remain accessible through their full pages. Financial amounts use the existing allocation and settlement-date calculations; no finance write path was changed.
- Application stage choices depend on the selected programme and reset when it changes. Preparation only includes the programme's preparation/installation/handover stages, excluding initial review and first appointments.
- Dossiers have four main sections: Identité, Programme & contrat, Véhicule, Argent & historique. Existing document review, installation, contract, financing, expense, journal and draft-recovery modules retain their hosts. Old internal section identifiers resolve to the new parent section.
- Birth-date entry rejects future/under-18 dates. Contract end and first-payment dates are checked against the entered service dates. Lydie's recorded birth date was **not changed**, as requested; staff must obtain and enter the correct date.

## Appointment close-out

`private.expire_past_appointments()` runs hourly at minute 05. Only `scheduled` bookings on previous Kinshasa calendar days are marked `missed`; confirmed/completed/cancelled bookings and today's/future bookings are preserved. The existing audit trigger records the change, with an explicit automatic-close reason. No business decision, SMS cancellation or financial movement is inferred.

The historical row has **A eu lieu · corriger**. Staff can reopen an automatically closed booking, with a reason and request ID, to record its actual workflow decision. This provides a 24-hour grace period and refuses to reopen when another appointment is already active for the dossier. The original close metadata and audit trail remain.

## SMS delivery reports

Provider acceptance is not handset delivery. The SMS configuration endpoint now includes a restricted health summary: latest actual callback, unconfirmed count and count older than 24 hours. It never exposes the worker token; the existing callback URL remains restricted to super administrators.

The authenticated delivery-report receiver was already deployed with JWT gateway verification disabled and its own private callback-key validation. Its callback handling tests pass. As of the production audit, **no delivery reports had arrived**. The app cannot turn the 71 accepted messages into delivered messages without actual provider reports, and does not resend them automatically.

To connect the provider, open **Paramètres → SMS & notifications**, expand **Configurer les rapports de livraison Africa’s Talking**, copy the private URL and save it under Africa's Talking **SMS → Callback URLs → Delivery Reports**. After the next real provider callback, the app shows the latest report time and the corresponding final status. Old provider reports may require provider-side reconciliation; no historical delivery is invented.

## Verification

Automated checks cover programme filters, owner-directory search, four sections, birth-date validation, actionable preparation, phone menu/layout, draft recovery, reviewed-document guards, device SIMs, repairs, manual fuel, dashboard financial pagination/stale-state recovery, callback authentication, SMS deduplication and appointment expiry/correction permissions.
