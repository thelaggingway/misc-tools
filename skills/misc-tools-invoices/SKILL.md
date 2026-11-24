---
name: misc-tools-invoices
description: Makes Indian invoices, proforma invoices, quotations, payment receipts, credit notes and debit notes as PDFs, with GST, amount in words and an optional UPI QR, from the business workspace's profile and client files. Use when the owner asks to bill, invoice, quote, issue a receipt or a credit/debit note, or to redo a document for a client.
---

# Invoices and related documents

Work in the business workspace (the folder with `misc-tools.json`). The tool lives at
`<toolsPath>/invoice-generator/`, where `toolsPath` comes from `misc-tools.json`. Run
`node <toolsPath>/invoice-generator/cli.mjs --help` for every field, and `--schema` for the JSON Schema.

## Make a document
1. **Find the inputs.** Seller details: `profiles/me.json` (or the profile the owner names). Client details:
   `clients/<client>.json`. If the client file is missing, use the misc-tools-client-intake skill first.
2. **Pick the number.** List `documents/<client>/` and take the next number in the same series
   (`ACME/2627/02` → `ACME/2627/03`; `2627` is financial year 2026-27, April to March). Quotes,
   receipts and notes have their own series (`QT/…`, `RC/…`, `CN/…`). Never reuse a number. Tell the owner
   which number you chose.
3. **Write only what changes** to `documents/<client>/<number with / replaced by _>.json`: `docType` (if not
   an invoice), `invNo`, `date`, `due`, `items`, and for receipts and notes `refInvoice`/`refDate`/`payMode`/`payRef`.
   Copy the previous document for the same client as a starting point when there is one.
4. **Check before rendering:**
   `node <toolsPath>/invoice-generator/cli.mjs profiles/me.json clients/<client>.json documents/<client>/<file>.json --check`
5. **Render:** the same command with `-o documents/<client>/<file>.pdf` instead of `--check`.
6. **Look at the PDF** (open it, or turn page 1 into an image) and check the title, number, dates, amounts and
   amount in words. Show it to the owner.
7. If the workspace is a git repository, commit the JSON and PDF together once the owner approves.

## Tax facts to confirm, not assume
- **GST type.** Seller registered under GST and the client in the same state as the place of supply:
  `taxMode: "cgst_sgst"`; a different state: `"igst"`; seller not registered: `"none"` (prints Tax N/A).
  Place of supply for services is usually the client's location if the client is registered
  (IGST Act section 12). Confirm at https://cbic-gst.gov.in/gst-acts.html when unsure.
- **GST rate and SAC/HSN code.** Do not pick a rate or code from memory. Look the code up at
  https://cbic-gst.gov.in/gst-goods-services-rates.html (or the services rate notification) and tell the owner
  which page confirmed it.
- **A tax invoice to a registered buyer** must show the buyer's GSTIN (`toGstin`); CGST Rule 46:
  https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
  (this site can fail to load from outside India; the CGST Rules are also under https://cbic-gst.gov.in/gst-acts.html)
- **UPI QR** (`upiQr: true`, `upiId`): most banks cap one UPI payment at ₹1 lakh, so above that the QR leaves
  the amount for the payer to type. Ask the owner to scan a new QR once with their own phone.

## Never
- Edit, re-render or delete a document the owner has already sent. Fix it with a credit or debit note.
- Put the owner's or clients' details in the misc-tools repository; they belong in this workspace.
