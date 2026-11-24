---
name: misc-tools-invoices
description: Makes Indian invoices, export invoices for services in foreign currency, proforma invoices, quotations, payment receipts, credit notes and debit notes as PDFs, with GST, amount in words and an optional UPI QR, from the business workspace's profile and client files. Use when the owner asks to bill, invoice, quote, issue a receipt or a credit/debit note, or to redo a document for a client.
---

# Invoices and related documents

Work in the business workspace (the folder with `misc-tools.json`). The tool lives at
`<toolsPath>/invoice-generator/`, where `toolsPath` comes from `misc-tools.json`. Run
`node <toolsPath>/invoice-generator/cli.mjs --help` for every field, and `--schema` for the JSON Schema.

## Make a document
1. **Find the inputs.** Seller details: `profiles/me.json` (or the profile the owner names). Client details:
   `clients/<client>.json`. If the client file is missing, use the misc-tools-client-intake skill first.
2. **Pick the number** with the tool, never by hand:
   `node <toolsPath>/invoice-generator/cli.mjs --next documents/<client> [--series PREFIX] [--date YYYY-MM-DD]`
   It prints the next number after the highest one used in that series and financial year (`ACME/2627/02` →
   `ACME/2627/03`; `2627` is 2026-27, April to March, so it restarts at `/2728/01` in April). Without `--series`
   it continues the client's invoice series; pass `--series QT`, `RC`, `CN` for quotes, receipts and notes (it
   also checks other clients' folders, so shared series are not reused), and `--series <PREFIX>` for a new client.
   Pass `--date` when the document is not dated today. Tell the owner which number you chose.
3. **Write only what changes** to `documents/<client>/<number with / replaced by _>.json`: `docType` (if not
   an invoice), `invNo`, `date`, `due`, `items`, and for receipts and notes `refInvoice`/`refDate`/`payMode`/`payRef`
   (plus `tds` on a receipt when the client deducted TDS).
   Copy the previous document for the same client as a starting point when there is one.
4. **Check before rendering:**
   `node <toolsPath>/invoice-generator/cli.mjs profiles/me.json clients/<client>.json documents/<client>/<file>.json --check`
5. **Render:** the same command with `-o documents/<client>/<file>.pdf` instead of `--check`.
6. **Look at the PDF** (open it, or turn page 1 into an image) and check the title, number, dates, amounts and
   amount in words. Show it to the owner.
7. If the workspace is a git repository, commit the JSON and PDF together once the owner approves.

## Export invoice (services to a client outside India)
Use `docType: "export_invoice"` and put in the client file `buyerCountry`, `currency` and `place: "Outside India"`;
in the document, item rates in that currency, plus `exchangeRate` (rupees per unit), `exchangeRateSource`,
`exchangeRateDate` and `exportMode`:
- `"lut"` when the owner has filed a Letter of Undertaking for this financial year: add `lut: { "arn", "fy" }`
  (keep it in `profiles/me.json`). Ask the owner for the ARN or have them find it on the GST portal
  (https://www.gst.gov.in, Services > User Services > View My Submitted LUTs). Never invent one. An LUT covers
  one financial year (CBIC Circular 8/8/2017-GST, https://cbic-gst.gov.in/pdf/Final_Master_circular_LUT_Bond_04102017.pdf);
  the CLI rejects a `lut.fy` that is not the invoice's year.
- `"igst_paid"` when there is no LUT: IGST at `taxRate` is charged.
The tool prints the Rule 46 endorsement for the mode. Before saving, check:
- **That it is an export of services**: supplier in India, recipient and place of supply outside India, paid in
  convertible foreign exchange (IGST Act section 2(6),
  https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_IGST_Act/active/chapteri/section2_v1.00.html).
  If not, it is an ordinary invoice.
- **The exchange rate.** For services, CGST Rule 34(2) says the rate under generally accepted accounting
  principles for the date of time of supply
  (https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter4/rule34_v1.00.html).
  Ask the owner which rate they use (often the RBI reference rate, https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx)
  and record its source and date; do not guess a rate.

## Tax facts to confirm, not assume
- **GST type.** Prefer `taxMode: "auto"`: with `fromGstin` in the profile it compares the GSTIN's state with
  `place` (a state name or code from `rules/gst-state-codes.json`): same state CGST + SGST (UTGST in Union
  territories), different IGST, no GSTIN none. The CLI errors on an unknown place and warns when a fixed
  `cgst_sgst`/`igst` disagrees. What `auto` cannot decide is the place of supply itself: for services it is
  usually the client's location if the client is registered (IGST Act section 12). Confirm at
  https://cbic-gst.gov.in/gst-acts.html when unsure. The state codes come from the GSTN e-invoice master
  (https://einvoice1.gst.gov.in/Others/MasterCodes); if the CLI says the rule file does not cover the date,
  re-check that page and update the file rather than switching off `auto`.
- **GST rate and SAC/HSN code.** Do not pick a rate or code from memory. Look it up with
  `node <toolsPath>/shared/lookup.mjs sac <word or code>` (or `hsn …`) following the misc-tools-codes skill, then
  open the notification the lookup cites and confirm the code and rate there. Tell the owner which notification
  confirmed it.
- **Seller GSTIN.** A registered seller's invoice must show its GSTIN (`fromGstin`) and a registered buyer's
  (`toGstin`); CGST Rule 46:
  https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
  (this site can fail to load from outside India; the CGST Rules are also under https://cbic-gst.gov.in/gst-acts.html)
- **UPI QR** (`upiQr: true`, `upiId`): most banks cap one UPI payment at ₹1 lakh, so above that the QR leaves
  the amount for the payer to type. Ask the owner to scan a new QR once with their own phone.

## Never
- Edit, re-render or delete a document the owner has already sent. Fix it with a credit or debit note.
- Put the owner's or clients' details in the misc-tools repository; they belong in this workspace.
