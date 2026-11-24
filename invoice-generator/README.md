# Invoice generator

One template (`index.html`), two ways to fill it. Makes invoices, export invoices for services in a foreign
currency, proforma invoices, quotations, payment receipts, credit notes and debit notes, with an optional UPI QR
code to pay. Picks CGST+SGST or IGST from the seller's GSTIN and the place of supply, and gives the next number
in a series.

## Humans
Open `index.html` in a browser. Fill in the form; the A4 preview updates live.
**Download PDF** opens the print dialog: choose "Save as PDF". Inputs are saved in the browser;
Export/Import JSON saves a copy of an invoice to reuse later.

## Agents and scripts
In a workspace made by `setup.mjs`, agents follow the `misc-tools-invoices` skill. Directly:
```sh
node invoice-generator/cli.mjs profiles/me.json clients/acme.json documents/acme/INV_2627_01.json -o out.pdf
node invoice-generator/cli.mjs ... --check      # validate only
node invoice-generator/cli.mjs --schema         # JSON Schema for the input
node invoice-generator/cli.mjs --next documents/acme                 # next number, e.g. ACME/2627/03
node invoice-generator/cli.mjs --next documents/acme --series RC     # next receipt number
echo '{"invNo":"INV/1","items":[{"desc":"Design","rate":5000}]}' | node invoice-generator/cli.mjs - -o out.pdf
```
- JSON files merge left to right: seller profile, then client, then the document's own fields.
  Missing fields use the template's defaults. Keys starting with `$` (like `$schema`) are ignored.
- Needs Node 18+ and Chrome/Chromium (set `CHROME_PATH` if it is not found). No npm install.
- Prints the PDF path on success. On bad input it exits 1 and names every bad field, e.g.
  `items[0].rate: "abc" does not match a number`; unknown fields are rejected so typos fail loudly.
- `toGstin` and `fromGstin` are checked with their check digit; this catches typos, not whether the GSTIN is
  active (confirm at https://services.gst.gov.in/services/searchtp).

## Numbering (`--next`)
`--next <folder>` prints the next number as `PREFIX/<financial year>/NN`, one more than the highest number
already used in that series and financial year (`TATVARTH/2627/02` → `TATVARTH/2627/03`). The financial year runs
April to March, so on 1 April the series restarts at `/2728/01`. It reads `invNo` from every JSON and the
`PREFIX_2627_NN` part of every file name in the folder, and in all of `documents/` when the folder is
`documents/<client>`, so a series shared by several clients (`RC/…`) is never reused. Gaps are never refilled.
- Without `--series`, the prefix is the one on the folder's latest invoice; a new client needs `--series ACME`.
- `--date YYYY-MM-DD` picks the financial year (default today).

## Automatic GST (`taxMode: "auto"`)
With `fromGstin` set, the seller's state is its first two digits. `place` (a state name like `Karnataka` or a
GST state code like `29`, `29-Karnataka`) is looked up in [`rules/gst-state-codes.json`](../rules/gst-state-codes.json).
Same state: CGST + SGST (CGST + UTGST in the Union territories the UTGST Act lists); different: IGST; no
`fromGstin`: no tax. An unknown `place`, or a date outside the rule file's coverage, is an error. CGST and SGST
are worked out per line in paise: CGST is half of the line's tax rounded down, SGST the rest, so an odd paisa goes
to SGST. With a fixed `cgst_sgst` or `igst`, the CLI warns when it disagrees with what `auto` would pick.
In the browser, the state list loads when the page is served over http; opened as a file, `auto` needs `place` as
a state code.

## Export invoice (`docType: "export_invoice"`)
A tax invoice for export of services. Item rates are in `currency`; the totals show the amount in that currency
and its rupee equivalent at `exchangeRate`, with the rate's source and date. It prints the endorsement from the
second proviso to CGST Rule 46, word for word:
- `exportMode: "lut"`: "SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS
  UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX", plus the LUT's ARN and financial year.
- `exportMode: "igst_paid"`: "SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED
  OPERATIONS ON PAYMENT OF INTEGRATED TAX", with IGST at `taxRate` (computed on the rupee value too).

Source: https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
(read 2026-11-24). Required: `fromGstin`, `currency`, `exchangeRate`, `exchangeRateSource`, `buyerCountry`,
`exportMode`, and for `lut` both `lut.arn` and `lut.fy`; `lut.fy` must be the invoice's financial year (an LUT is
valid for the financial year it is furnished for, CBIC Circular 8/8/2017-GST). `taxMode` is ignored; the UPI QR is
not shown. `place` defaults to "Outside India".

## JSON fields
| Field | Meaning |
|---|---|
| `fromName`, `fromAddress` | Seller name and one-line address |
| `fromTag` | Text under "INVOICE", e.g. `UNREGISTERED`. Still works; with `fromGstin` set, `UNREGISTERED` is rejected |
| `fromGstin` | Seller GSTIN, printed under the address; used by `taxMode: "auto"` |
| `toName`, `toAddress` | Client name; address with `\n` between lines |
| `toGstin` | Client GSTIN, shown under the address; required on a tax invoice to a registered buyer |
| `invNo`, `place` | Invoice number; place of supply as a state name or GST state code (a bare code prints as `Karnataka (29)`) |
| `date`, `due` | `YYYY-MM-DD` |
| `items` | Array of `{ desc, sac, qty, unit, rate }`; amount = qty × rate |
| `taxMode` | `auto` (see above), `none` (shows N/A), `cgst_sgst` (rate split in half per line), `igst` |
| `taxRate` | Total GST % (default 18) |
| `bankName`, `bank`, `acct`, `ifsc`, `terms` | Bank details block |
| `footer`, `signName` | Footer note, signatory name |
| `docType` | `invoice` (default), `proforma`, `quotation`, `receipt`, `credit_note`, `debit_note` |
| `refInvoice`, `refDate` | Original invoice number and date; shown on receipts, credit notes and debit notes |
| `payMode`, `payRef` | Payment mode (UPI, NEFT, cash) and UTR; shown on receipts |
| `notes` | Free text below the amount in words, e.g. the reason for a credit note |
| `currency`, `exchangeRate`, `exchangeRateSource`, `exchangeRateDate` | Export invoices: currency code, rupees per unit, where the rate is from and its date |
| `buyerCountry`, `exportMode`, `lut` | Export invoices: country of destination; `lut` or `igst_paid`; `{ "arn", "fy" }` of the Letter of Undertaking |
| `tds`, `tdsSection` | Not printed. Receipts: rupees the client deducted as TDS; the client's TDS rule id from `rules/tds-sections.json` (checked). Read by [receivables](../receivables/) |
| `upiQr`, `upiId`, `upiName` | `true` plus a UPI ID adds a pay-by-UPI QR on invoices, proformas and debit notes. `upiName` defaults to `fromName` |

## Document types
| `docType` | Title | Shows | Hides |
|---|---|---|---|
| `invoice` | INVOICE, or TAX INVOICE when tax is charged | due date, bank, UPI QR | |
| `proforma` | PROFORMA INVOICE, marked "Not a tax invoice" | valid until, bank, UPI QR | |
| `quotation` | QUOTATION | valid until | bank, UPI QR |
| `receipt` | PAYMENT RECEIPT; total reads "Amount Received" | invoice reference, payment mode and UTR | due date, bank, UPI QR |
| `credit_note` | CREDIT NOTE; total reads "Total Credit" | invoice reference | due date, bank, UPI QR |
| `debit_note` | DEBIT NOTE | invoice reference, due date, bank, UPI QR | |
| `export_invoice` | TAX INVOICE, "Export of services" | Rule 46 endorsement, country, LUT, rupee equivalent, due date, bank | UPI QR |

Number each type in its own series (e.g. `INV/2627/01`, `QT/2627/01`, `RC/2627/01`). `--next` gives the next number in a series.

## UPI QR
The QR encodes `upi://pay?pa=<upiId>&pn=<name>&cu=INR&tn=<title and number>&am=<total>`, drawn offline with the
inlined MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator). Most banks cap a single
UPI payment at ₹1 lakh, so above that the QR leaves the amount out (the payer types it, e.g. in parts) and says so.
`tr` (transaction reference) is left out: it is meant for registered merchants and some apps reject it on a
personal UPI ID. Scan a new QR with your own phone once before sending it to a client.

See `examples/`: `profile.json` (unregistered seller) with `invoice.json` or `receipt.json`; add `registered.json`
(seller GSTIN) for `gst-auto.json` or `export-invoice.json`. All names, GSTINs and numbers there are made up.
