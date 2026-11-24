# Salary slip

A monthly wage slip for a small employer: employer and employee details, wage period and days paid,
earnings, deductions, gross, net and net in words, on one A4 page. The particulars follow Form V of the
Code on Wages (Central) Rules, 2026 — the wage slip rule 52 requires under section 50(3) of the Code on
Wages, 2019.

## Humans
Open `index.html` in a browser. Fill in the form; the A4 preview updates live.
**Download PDF** opens the print dialog: choose "Save as PDF". Inputs are saved in the browser;
Export/Import JSON saves a copy to reuse next month.

## Agents and scripts
In a workspace made by `setup.mjs`, agents follow the `misc-tools-salary-slip` skill. Directly:
```sh
node salary-slip/cli.mjs employer.json employees/rohan.json documents/payroll/2026-11.json -o slip.pdf
node salary-slip/cli.mjs ... --check      # validate only, no PDF
node salary-slip/cli.mjs --schema         # JSON Schema for the input
node salary-slip/cli.mjs --help           # this file
```
- JSON files merge left to right: the employer's details, then the employee's, then the month's own fields.
  Keys starting with `$` (like `$schema`) are ignored.
- Needs Node 18+ and Chrome/Chromium (set `CHROME_PATH` if it is not found). No npm install.
- Prints the PDF path on success. On bad input it exits 1 and names every bad field; unknown fields are
  rejected so typos fail loudly.

## Deductions from the rules
With `"autoDeductions": true` the CLI works out the employee's PF, ESI and professional tax from the dated
files in [`rules/`](../rules/), and prints a short "Basis of deductions" block on the slip saying which rate
and ceiling it used:

| Deduction | From | Basis |
|---|---|---|
| PF (employee) | `rules/pf-esi.json` | 12% of basic + DA, capped at the wage ceiling (₹15,000 to 16 Sep 2026, ₹25,000 from 17 Sep 2026; a month that spans the change is split by days) |
| ESI (employee) | `rules/pf-esi.json` | 0.75% of gross wages, only up to the ₹21,000 ceiling (₹25,000 for a person with disability) |
| Professional tax | `rules/professional-tax.json` | the state's slabs: Maharashtra, Karnataka, Telangana, Gujarat, Madhya Pradesh, and Tamil Nadu (Chennai) — in Tamil Nadu each urban local body sets its own, so only the Greater Chennai Corporation schedule is filed, under the state name `Tamil Nadu (Chennai)` |

Without `autoDeductions`, PF, ESI and professional tax are taken exactly as given — use that when the
establishment is not covered, when the employee is outside a scheme, or for a state whose schedule is not in
the rules file. West Bengal is **not** in the file: the only schedule found was a proposed one, so the CLI
refuses to guess (see the `unverified` note in `rules/professional-tax.json`).

TDS is never computed: pass the month's figure. The tool is not tax advice.

In the browser the same computation runs only when the page can read `rules/` — that needs a local web
server (for example `python3 -m http.server` in the repository root). Opened from `file://` the browser will
not read a neighbouring file, so the page shows whatever figures the CLI worked out; open the CLI's PDF, or
type the amounts and leave the checkbox off.

## JSON fields
| Field | Meaning |
|---|---|
| `employerName`, `employerAddress`, `employerRef` | Establishment name, one-line address, registration numbers (LIN, GSTIN) |
| `slipNo`, `issueDate` | Wage slip number and the date it is issued (`YYYY-MM-DD`) |
| `month` | Wage period as `YYYY-MM`; the slip prints the first and last day |
| `employeeName`, `employeeGuardian`, `designation`, `employeeCode`, `department` | Employee particulars; Form V asks for the father's/mother's/spouse's name |
| `uan`, `esiNumber`, `pan`, `bankAccount`, `ifsc` | Account numbers; PAN and IFSC are format-checked |
| `daysPaid`, `lopDays` | Days paid and days of loss of pay. Leave `daysPaid` out to use the days in the month less `lopDays` |
| `basic`, `da`, `hra`, `overtime` | Earnings for the month |
| `allowances` | Array of `{ name, amount }` |
| `state`, `gender` | State where the employee works, for professional tax. `gender` is used only where a state's slabs differ (Maharashtra) |
| `autoDeductions` | `true` computes PF, ESI and professional tax from `rules/` |
| `pfApplicable`, `esiApplicable`, `esiDisability` | Whether EPF/ESIC cover the employee, and whether the higher ESI ceiling applies |
| `pf`, `esi`, `professionalTax` | Explicit amounts; overwritten when `autoDeductions` is true |
| `tds`, `advances` | Tax deducted at source, and salary advance recovered, for the month |
| `otherDeductions` | Array of `{ name, amount }` |
| `deductionBasis` | Lines saying how the deductions were worked out; the tool fills it, leave it empty |
| `notes`, `footer`, `signName` | Free text, footer note, and the person signing for the employer |

## Before you rely on it
- Open the official page for each rate the slip uses and confirm it for the month you are paying:
  EPFO (https://www.epfindia.gov.in) and ESIC (https://esic.gov.in) for PF and ESI, and the state's
  commercial tax department for professional tax. The rules files list the exact pages.
- The slip is not a substitute for the registers the Code on Wages requires (Form IV) or for the ECR filed
  with EPFO.
- Check the state's own rules for exemptions: some states exempt people with disability, ex-servicemen or
  low wages, and Maharashtra's slabs differ for women.

See `examples/` for made-up employer, employee and month files.
