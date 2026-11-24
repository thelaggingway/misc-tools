# Invoice generator

One template (`index.html`), two ways to fill it. Makes invoices, proforma invoices, quotations,
payment receipts, credit notes and debit notes, with an optional UPI QR code to pay.

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
echo '{"invNo":"INV/1","items":[{"desc":"Design","rate":5000}]}' | node invoice-generator/cli.mjs - -o out.pdf
```
- JSON files merge left to right: seller profile, then client, then the document's own fields.
  Missing fields use the template's defaults. Keys starting with `$` (like `$schema`) are ignored.
- Needs Node 18+ and Chrome/Chromium (set `CHROME_PATH` if it is not found). No npm install.
- Prints the PDF path on success. On bad input it exits 1 and names every bad field, e.g.
  `items[0].rate: "abc" does not match a number`; unknown fields are rejected so typos fail loudly.
- `toGstin` is checked with its check digit; this catches typos, not whether the GSTIN is active.

## JSON fields
| Field | Meaning |
|---|---|
| `fromName`, `fromAddress` | Seller name and one-line address |
| `fromTag` | Text under "INVOICE", e.g. `UNREGISTERED` or `GSTIN: 23ABCDE1234F1Z5` |
| `toName`, `toAddress` | Client name; address with `\n` between lines |
| `toGstin` | Client GSTIN, shown under the address; required on a tax invoice to a registered buyer |
| `invNo`, `place` | Invoice number, place of supply |
| `date`, `due` | `YYYY-MM-DD` |
| `items` | Array of `{ desc, sac, qty, unit, rate }`; amount = qty × rate |
| `taxMode` | `none` (shows N/A), `cgst_sgst` (rate split in half), `igst` |
| `taxRate` | Total GST % (default 18) |
| `bankName`, `bank`, `acct`, `ifsc`, `terms` | Bank details block |
| `footer`, `signName` | Footer note, signatory name |
| `docType` | `invoice` (default), `proforma`, `quotation`, `receipt`, `credit_note`, `debit_note` |
| `refInvoice`, `refDate` | Original invoice number and date; shown on receipts, credit notes and debit notes |
| `payMode`, `payRef` | Payment mode (UPI, NEFT, cash) and UTR; shown on receipts |
| `notes` | Free text below the amount in words, e.g. the reason for a credit note |
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

Number each type in its own series (e.g. `INV/2627/01`, `QT/2627/01`, `RC/2627/01`). Numbering is not automatic.

## UPI QR
The QR encodes `upi://pay?pa=<upiId>&pn=<name>&cu=INR&tn=<title and number>&am=<total>`, drawn offline with the
inlined MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator). Most banks cap a single
UPI payment at ₹1 lakh, so above that the QR leaves the amount out (the payer types it, e.g. in parts) and says so.
`tr` (transaction reference) is left out: it is meant for registered merchants and some apps reject it on a
personal UPI ID. Scan a new QR with your own phone once before sending it to a client.

See `examples/` for a full profile and a per-invoice file.
