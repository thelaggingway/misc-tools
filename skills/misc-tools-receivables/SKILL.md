---
name: misc-tools-receivables
description: Reports who owes the owner money from the business workspace's invoices, receipts and credit notes, with age buckets, TDS deducted per client per financial year (to match Form 26AS/AIS), FEMA deadlines for export invoices, and draft payment reminders. Use when the owner asks "who hasn't paid", "what's outstanding", "send reminders", "chase payments", "how much TDS was deducted", or about export payments still due.
---

# Receivables

Work in the business workspace (the folder with `misc-tools.json`). The tool lives at
`<toolsPath>/receivables/`, where `toolsPath` comes from `misc-tools.json`. Run
`node <toolsPath>/receivables/cli.mjs --help` for the details.

## Get the picture
1. Run `node <toolsPath>/receivables/cli.mjs . ` (add `--as-of YYYY-MM-DD` if the owner asks about another day,
   `--json` if you need the numbers to work with, and `--payee other` if the owner is a firm, LLP or company).
2. Read the **Needs attention** section first. A receipt or credit note without a known `refInvoice` is not counted
   against any invoice: ask the owner which invoice it settles instead of guessing, then fix the receipt's JSON
   only if the owner has not sent it yet (otherwise tell them).
3. Answer the question in plain words: total outstanding, the oldest and largest invoices, what changed since last
   time. Give amounts in rupees with Indian grouping, as the report does.

## Recording a payment
When the owner says a client paid, make a receipt with the misc-tools-invoices skill (`docType: "receipt"`,
`refInvoice`, the amount actually received). If the client deducted TDS, add `"tds": <rupees deducted>` to the
receipt's JSON; the invoice then counts as settled by amount received + TDS. If you know which section the client
deducts under, set `tdsSection` in `clients/<client>.json` (ids: `professional_fees`, `technical_fees`,
`contractor`, `commission`, `rent_plant_machinery`, `rent_land_building`, `rent_by_individual`,
`paid_by_individual`).

## Reminders: draft, never send
The report has one WhatsApp draft and one email draft per client with overdue invoices. Show them to the owner,
adjust the tone if asked (a regular client may need something softer), and let the owner send them. Never send a
message, email or WhatsApp yourself, even if a tool for it is available. Leave out invoices the owner says are
disputed or already agreed to be paid later.

## TDS: verify before telling the owner
- The "TDS deducted" table is what Form 26AS / AIS should show for each client and financial year. Suggest the
  owner compare it at https://eportal.incometax.gov.in (Form 26AS / AIS); a missing entry usually means the
  client has not filed its TDS return or used a wrong PAN.
- Each `[warn]` in "TDS checks" compares the deduction with `rules/tds-sections.json`. Before telling the owner a
  deduction is wrong, open the section in that file's sources and confirm the rate and threshold:
  section 393 of the Income-tax Act 2025 at https://www.incometaxindia.gov.in/w/section-393-6 and the rates page
  https://www.incometaxindia.gov.in/w/tds-rates. A 20% deduction usually means the client did not have the owner's
  PAN (section 397(2), old 206AA, https://incometaxindia.gov.in/w/section-397-6). Say which page you checked.
- If the report says the rule file does not cover a date, do not work out the rate from memory: tell the owner the
  rule file needs re-checking.
- TDS is on the value without GST when GST is shown separately (CBDT Circular 23/2017); the tool already does this.

## Export invoices
For `docType: "export_invoice"` the report shows the FEMA deadline to realise the money: nine months from the
invoice date for services, twelve if invoiced in rupees (RBI FEMA 23(R)/2026-RB, regulation 5(1),
https://rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0). If one is close or past, tell the owner to talk
to their bank (the authorised dealer can extend the period). For invoices dated before 1 October 2026 the report
asks to confirm the period with the bank; pass that on.

## Never
- Edit a document the owner has already sent, or delete one to make the report look better.
- Send reminders or contact clients.
- Put the owner's or clients' details in the misc-tools repository.
