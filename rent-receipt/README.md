# Rent receipt

Rent receipts for a tenant claiming house rent allowance: one receipt per month, three to an A4 page, so a
year fits on four pages. Each receipt names the tenant, the month, the amount in figures and words, the
premises, how the rent was paid, and the landlord, with a box for a revenue stamp when the rent was paid in
cash.

## Humans
Open `index.html` in a browser. Fill in the form; the pages update live. **Download PDF** opens the print
dialog: choose "Save as PDF". Inputs are saved in the browser; Export/Import JSON saves a copy.

## Agents and scripts
In a workspace made by `setup.mjs`, agents follow the `misc-tools-rent-receipt` skill. Directly:
```sh
node rent-receipt/cli.mjs landlords/suresh.json documents/rent/suresh/2026-27.json -o receipts.pdf
node rent-receipt/cli.mjs ... --check      # validate only, no PDF
node rent-receipt/cli.mjs --schema         # JSON Schema for the input
node rent-receipt/cli.mjs --help           # this file
```
- JSON files merge left to right: the landlord (and tenant, premises, rent), then the months and payments.
- Needs Node 18+ and Chrome/Chromium (set `CHROME_PATH` if it is not found). No npm install.
- Prints the PDF path on success. On bad input it exits 1 and names every bad field.

## Months
Give either a list, `"months": ["2026-04", "2026-05"]`, or a range, `"from": "2026-04", "to": "2027-03"`,
which is read as every month from the first to the last inclusive. Each receipt is dated the last day of its
month. If a payment date has to differ, make that month its own file.

## The two rules that shape the receipt
Both live in [`rules/hra-rent.json`](../rules/hra-rent.json) with their official sources; the CLI refuses a
month the file does not cover, and never guesses.

| Rule | What the tool does |
|---|---|
| **Landlord's PAN** — Form 124 (earlier Form 12BB), rule 205 of the Income-tax Rules, 2026 (rule 26C of the 1962 rules), section 392(5)(b) of the Income-tax Act, 2025 | If the rent comes to more than the threshold for a year (₹1,00,000) and `landlordPan` is empty, the CLI stops and says so. A PAN that is given is format-checked |
| **Revenue stamp** — Indian Stamp Act, 1899, section 30 and Schedule I article 53 | A cash receipt above the threshold (₹5,000) prints a stamp box, for a ₹1 revenue stamp. A receipt for rent paid by cheque, UPI or bank transfer does not need one |

The stamp box is a box, not a stamp: print the page, affix the revenue stamp over it, and have the landlord
sign across it.

## JSON fields
| Field | Meaning |
|---|---|
| `landlordName`, `landlordAddress`, `landlordPan` | Who receives the rent; PAN is required above the annual threshold |
| `tenantName`, `tenantAddress` | Who pays; the name should match the HRA claim |
| `propertyAddress` | The rented premises; `\n` between lines |
| `rent` | Monthly rent in rupees |
| `months`, or `from` and `to` | Which months to make receipts for |
| `paymentMode`, `paymentRef` | `Cash`, `UPI`, `NEFT`, `Cheque` … and the UTR or cheque number |
| `place`, `signName` | Place above the signature; the name defaults to the landlord's |
| `notes` | One line at the foot of every receipt |
| `stampRequired` | Set by the tool; leave it out |

## Before you rely on it
- Confirm the two thresholds on the official pages: the PAN requirement in the Form 124 FAQ at
  https://www.incometaxindia.gov.in/documents/d/guest/form-124-faqs, and the stamp duty in Schedule I of the
  Indian Stamp Act at https://www.indiacode.nic.in.
- HRA exemption is the least of three amounts — rent paid less 10% of salary, 50% of salary in a metro, 40%
  elsewhere — and the receipt is only evidence of the rent. It is not tax advice.
- The landlord's PAN must be the real PAN. A receipt with a made-up PAN is worse than no receipt.

See `examples/` for a made-up landlord, tenant, a full-year range and a single cash month.
