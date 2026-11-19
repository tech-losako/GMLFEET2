# Payment confirmations and branded receipts — 19 November 2026

## Channels

The live records showed delivered WhatsApp finance alerts for George Bakaly and
Eric Kayembe. Eric Ebabi's current staff phone had no WhatsApp preference, so his
alerts used SMS. His existing finance-alert recipient is now opted into WhatsApp,
with the project operator's request recorded in the audit trail.

The notifications page now shows the configured channel for each finance-alert
recipient. The dispatcher retains explicit recipient preferences, verified approved
templates, the global pause switch, and exactly one SMS fallback after a confirmed
WhatsApp failure. Unknown outcomes are not automatically resent. Clients without
a WhatsApp preference continue to receive the transaction confirmation by SMS.

SMS recipients are normalized before provider submission, including phone numbers
containing spaces. No historical notifications are replayed by this change.

## Client content

New cash and verified digital payment confirmations acknowledge the actual GML
share (`payment.amount - payment.lolc_amount`). Examples: 29.50 USD received with
27.00 USD allocated to LOLC confirms 2.50 USD for GML; 177.00 / 162.00 confirms
15.00 USD for GML. Client SMS does not mention LOLC. The existing approved French
WhatsApp confirmation template has no LOLC wording and now receives that GML-only
amount. Reversals use GML-only SMS because the older WhatsApp cancellation template
mentions LOLC. A zero-GML payment does not create a misleading GML receipt message.

Internal finance alerts retain the actual full received amount and split. Payment
rows, allocations, balances, fees and repayment schedules are not modified.

## PDF

The cashier's old receipt was a basic HTML print view. Both cashier and driver
downloads now use `payment-receipt.js`, with the real loaded company logo, company
identifiers/address/contact, stable payment reference, confirmation date, recorded
amounts and print/download options. The PDF acknowledges the full money received
and its actual breakdown; the client notification separately highlights GML's share.
Equipment receipts use the same style and show the actual payment even when partial.
Reversals and cancelled payments are visibly labelled; pending payments cannot make
a confirmed receipt. No signature is invented.

Validation: `payment-gml-notifications-database.cjs`, `sms-delivery-edge.cjs`,
`whatsapp-sending-edge.cjs`, `branded-payment-receipt-browser.cjs` and the existing
SMS admin browser test. The demonstration PDF is `output/pdf/exemple-recu-gml.pdf`;
its pages were rendered and visually reviewed. Tests use fictional data and do not
send payment messages.

The supplied company stamp is embedded unchanged in cashier, driver and equipment
receipt PDFs, aligned left beneath the payment details. The explanatory receipt
and electronic-reproduction sentences are omitted. Both logo and stamp must load
before a PDF can be generated.
