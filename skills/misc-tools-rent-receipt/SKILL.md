---
name: misc-tools-rent-receipt
description: Makes rent receipts (one per month, three to an A4 page) for a tenant claiming house rent allowance, with the landlord's PAN where the rules need it and a revenue stamp box on cash months. Use when the owner asks for rent receipts, proof of rent paid, or HRA documents.
---

# Rent receipts

Work in the business workspace (the folder with `misc-tools.json`). The tool lives at
`<toolsPath>/rent-receipt/`, where `toolsPath` comes from `misc-tools.json`. Run
`node <toolsPath>/rent-receipt/cli.mjs --help` for every field, and `--schema` for the JSON Schema.

## Where things live
- `landlords/<name>.json`: the standing details — `landlordName`, `landlordAddress`, `landlordPan`, `place`,
  and the tenant and premises, which rarely change: `tenantName`, `tenantAddress`, `propertyAddress`, `rent`.
  Lowercase file names, e.g. `landlords/suresh-kumar.json`.
- `documents/rent/<landlord>/<FY>.json` and `.pdf`: the months and payments for one year, with `FY` as
  `2026-27` (April to March).
- The tenant is the owner. Take their name and address from `profiles/me.json` (map `fromName` and
  `fromAddress`) or from the previous year's file, and read them back before saving.

## Make the receipts
1. Read the landlord file. If the landlord's PAN is missing and the rent is above the annual threshold, ask for
   it; never make up a number, and never put a wrong PAN on a receipt.
2. Ask which months are needed and how each was paid — cash, UPI, NEFT, cheque — with the reference (UTR or
   cheque number). If a month was paid in two parts, say so in `notes`.
3. Write `documents/rent/<landlord>/<FY>.json`: `from` and `to` (or a `months` list), `paymentMode`,
   `paymentRef`, `notes`.
4. Check:
   `node <toolsPath>/rent-receipt/cli.mjs landlords/<name>.json documents/rent/<landlord>/<FY>.json --check`
5. Render: the same command with `-o documents/rent/<landlord>/<FY>.pdf`.
6. **Look at the PDF**: every month present and in order, the amounts and the words right, the landlord's PAN,
   and a stamp box on the cash months. Show it to the owner.
7. Tell the owner what to do on paper: print it, have the landlord sign each receipt, and where a stamp box
   appears, affix a revenue stamp and have the landlord sign across it.

## Rules to confirm, not assume
- **Landlord's PAN** is required when the rent for the year is above the threshold (₹1,00,000) — Form 124
  (earlier Form 12BB), rule 205 of the Income-tax Rules, 2026, section 392(5)(b) of the Income-tax Act, 2025.
  Check the current form and its FAQ at https://www.incometaxindia.gov.in/documents/d/guest/form-124-faqs. The
  CLI stops when it is needed and missing.
- **Revenue stamp**: a receipt for more than ₹5,000 paid in cash needs one (Indian Stamp Act, 1899, section 30
  and Schedule I article 53); a receipt for rent paid by cheque or bank transfer does not. The schedule is at
  https://www.indiacode.nic.in. If the CLI says the month is outside the rules file's coverage, tell the owner
  which page needs re-checking instead of guessing.
- HRA exemption is worked out from salary, rent and city, not from the receipt alone. Do not tell the owner what
  they can claim; that is their CA's call.

## Never
- Make a receipt for a month the tenant did not pay, or change one after the landlord has signed it.
- Put the owner's, tenant's or landlord's details in the misc-tools repository.
