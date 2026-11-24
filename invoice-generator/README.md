# Invoice generator

One template (`index.html`), two ways to fill it.

## Humans
Open `index.html` in a browser. Fill in the form; the A4 preview updates live.
**Download PDF** opens the print dialog: choose "Save as PDF". Inputs are saved in the browser;
Export/Import JSON saves a copy of an invoice to reuse later.

## Agents and scripts
```sh
node invoice-generator/cli.mjs [profile.json] invoice.json -o out.pdf
echo '{"invNo":"INV/1","items":[{"desc":"Design","rate":5000}]}' | node invoice-generator/cli.mjs - -o out.pdf
```
- JSON files merge left to right, so keep your fixed details (seller, client, bank) in a profile file and
  pass only what changes per invoice. Missing fields use the template's defaults.
- Needs Node 18+ and Chrome/Chromium (set `CHROME_PATH` if it is not found). No npm install.
- Prints the PDF path on success; exits 1 with a message naming the bad field on invalid input.
- Unknown fields are rejected, so a typo fails loudly instead of silently disappearing.

## JSON fields
| Field | Meaning |
|---|---|
| `fromName`, `fromAddress` | Seller name and one-line address |
| `fromTag` | Text under "INVOICE", e.g. `UNREGISTERED` or `GSTIN: 23ABCDE1234F1Z5` |
| `toName`, `toAddress` | Client name; address with `\n` between lines |
| `invNo`, `place` | Invoice number, place of supply |
| `date`, `due` | `YYYY-MM-DD` |
| `items` | Array of `{ desc, sac, qty, unit, rate }`; amount = qty × rate |
| `taxMode` | `none` (shows N/A), `cgst_sgst` (rate split in half), `igst` |
| `taxRate` | Total GST % (default 18) |
| `bankName`, `bank`, `acct`, `ifsc`, `terms` | Bank details block |
| `footer`, `signName` | Footer note, signatory name |

See `examples/` for a full profile and a per-invoice file.
