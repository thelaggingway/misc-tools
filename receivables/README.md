# Receivables

Who owes you what. Reads every document in a workspace and reports:
- **unpaid and part-paid invoices** with age buckets: not yet due, 0-30, 31-60, 61-90 and 90+ days past due;
- **TDS deducted** per client per financial year, to match against Form 26AS / AIS, and a check of each
  receipt's TDS against the rate in [`rules/tds-sections.json`](../rules/tds-sections.json);
- **FEMA realisation deadlines** for export invoices;
- **draft reminders** (WhatsApp and email text) for overdue invoices, one per client. Drafts only: nothing is sent.

## Humans
Open `index.html` in Chrome, Edge or Firefox and choose your workspace folder. To check TDS rates when the page
is opened as a file, also choose `rules/tds-sections.json` from this repo (it loads on its own when the page is
served over http). Pick the "as of" date and click **Print / Save PDF**. Nothing leaves your computer.

## Agents and scripts
In a workspace, agents follow the `misc-tools-receivables` skill. Directly:
```sh
node receivables/cli.mjs ~/my-business                        # Markdown report, as of today (India time)
node receivables/cli.mjs ~/my-business --as-of 2026-11-24     # as of a date; later documents are left out
node receivables/cli.mjs ~/my-business --json                 # everything, for scripts and agents
node receivables/cli.mjs ~/my-business -o receivables.pdf     # the same page as index.html, as a PDF
node receivables/cli.mjs ~/my-business --payee other          # you are a firm/LLP/company (contractor TDS 2%, not 1%)
node receivables/cli.mjs --schema                             # fields it reads from documents
```
Try it on the made-up workspace: `node receivables/cli.mjs receivables/examples/workspace --as-of 2026-11-24`.

## How it counts
Each `documents/<client>/*.json` is merged over `profiles/me.json` and `clients/<client>.json`, like the invoice
CLI, and totalled the same way as the printed PDF (qty × rate, plus GST for `cgst_sgst`/`igst`).

| `docType` | Effect |
|---|---|
| `invoice` (default), `debit_note`, `export_invoice` | Adds to what the client owes, due on `due` (or on `date` if there is no due date) |
| `receipt` | Settles `refInvoice` by the amount received **plus `tds`** |
| `credit_note` | Reduces `refInvoice` |
| `proforma`, `quotation` | Ignored |

So ₹1,25,000 invoiced, a receipt of ₹1,12,500 with `"tds": 12500` is fully settled. A receipt or note whose
`refInvoice` is missing or unknown is listed under "Needs attention", not guessed. Documents dated after the
as-of date are left out.

## Fields it reads
| Field | Where | Meaning |
|---|---|---|
| `tds` | receipt | Rupees the client deducted as TDS from this payment |
| `tdsSection` | client file or receipt | Rule id the client deducts under: `professional_fees`, `technical_fees`, `contractor`, `commission`, `rent_plant_machinery`, `rent_land_building`, `rent_by_individual`, `paid_by_individual` |
| `currency`, `exchangeRate`, `buyerCountry` | export invoice (or its client file) | Invoice currency (default INR), rupees per unit, buyer's country. A receipt in rupees against a foreign-currency invoice is converted at its own `exchangeRate`, else the invoice's |

**Note:** `invoice-generator/schema.json` does not accept `tds` and `tdsSection` yet, so its `--check` rejects
receipts and client files that use them until that schema adds the two fields.

## TDS check
The TDS base is the invoice value without GST (CBDT Circular 23/2017, when GST is shown separately), so a
receipt's base is (received + TDS) × taxable value ÷ invoice total. With `tdsSection` set, the check compares
the TDS with that section's rate and flags a difference, noting when the deduction is 20%, the no-PAN rate
(section 397(2), old 206AA). Without `tdsSection` it reports the implied rate and which sections it matches.
It also flags a client whose yearly billing passed its section's threshold with no TDS recorded. In code:
`expectedTds(rules, { section, date, base, payee, pan })` from `receivables.js`.

Rule files are dated: dates outside `coverage` are not checked, and the report says so.

## FEMA
Export proceeds must be realised within nine months of the invoice date for services (from shipment for goods),
or twelve months when invoiced or settled in rupees: RBI Notification FEMA 23(R)/2026-RB, regulation 5(1), in force
from 1 October 2026 (https://rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0). Invoices dated earlier are
flagged to confirm with the bank. The 2015 regulations applied to them, and their nine months was seen only in an
excerpt of RBI's Master Direction.

Not tax advice. Rates and rules change; confirm with the official source or a chartered accountant.
