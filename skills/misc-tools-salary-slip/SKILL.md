---
name: misc-tools-salary-slip
description: Makes a monthly wage slip (payslip) PDF for an employee, with PF, ESI and professional tax worked out from the dated rules and the particulars Form V of the Code on Wages (Central) Rules, 2026 asks for. Use when the owner asks for a payslip, salary slip or wage slip, or to redo one for a month.
---

# Wage slips

Work in the business workspace (the folder with `misc-tools.json`). The tool lives at
`<toolsPath>/salary-slip/`, where `toolsPath` comes from `misc-tools.json`. Run
`node <toolsPath>/salary-slip/cli.mjs --help` for every field, and `--schema` for the JSON Schema.

## Where things live
- `profiles/employer.json`: the establishment — `employerName`, `employerAddress`, `employerRef` (LIN, GSTIN),
  `signName`. Make it once from `profiles/me.json` or the owner's own details, and read the numbers back to them.
- `employees/<name>.json`: one file per employee — `employeeName`, `employeeGuardian`, `designation`,
  `employeeCode`, `department`, `uan`, `esiNumber`, `pan`, `bankAccount`, `ifsc`, `state`, `gender`.
  Lowercase file names, e.g. `employees/rohan-mehta.json`.
- `documents/payroll/<employee>/<YYYY-MM>.json` and `.pdf`: each month's figures next to the slip.

## Make a slip
1. Read the employee file and `profiles/employer.json`. If either is missing, ask for the details; never guess
   a UAN, PAN, IFSC or state.
2. Get the month's figures from the owner: basic, DA, HRA, allowances, overtime, days paid, loss of pay, and
   any TDS or advance recovered. Do not invent amounts.
3. Write `documents/payroll/<employee>/<YYYY-MM>.json` with `month`, `slipNo`, `issueDate`, the earnings,
   `state`, and `autoDeductions: true`. Add `tds` and `advances` when there are any. Take the next `slipNo`
   from the last slip for that employee; never reuse one.
4. Check:
   `node <toolsPath>/salary-slip/cli.mjs profiles/employer.json employees/<name>.json documents/payroll/<employee>/<YYYY-MM>.json --check`
5. Render: the same command with `-o documents/payroll/<employee>/<YYYY-MM>.pdf`.
6. **Look at the PDF** and check the name, UAN, month, days, gross, every deduction, the net and the amount in
   words. Read the "Basis of deductions" block: it says which rate and ceiling were used.
7. Show the owner the slip and say what you checked. If the workspace is a git repository, commit the JSON and
   PDF together once they approve.

## Rates to confirm, not assume
The tool works PF, ESI and professional tax out of `rules/` in the tools repo and prints the basis on the
slip. Before saving a slip, open the official page for each figure it used and confirm it for that month; say
what you checked and where.
- **PF**: 12% of basic + DA, capped at the wage ceiling. EPFO FAQ, https://www.epfindia.gov.in/site_en/FAQ.php
  (question 119), and the ceiling notification listed in `rules/pf-esi.json`. The ceiling rose from ₹15,000 to
  ₹25,000 on 17 September 2026, so a September 2026 slip is split by days at each ceiling; EPFO's own FAQ works
  an example the same way.
- **ESI**: 0.75% of gross wages, only up to the ceiling (₹21,000; ₹25,000 for a person with disability).
  https://esic.gov.in/contribution
- **Professional tax**: the state's own schedule — Maharashtra (mahagst.gov.in), Karnataka
  (ptax.karnataka.gov.in), Telangana (tgct.gov.in), Gujarat (commercialtax.gujarat.gov.in), Madhya Pradesh
  (mptax.mp.gov.in). Tamil Nadu is different: each urban local body sets its own schedule, so the rules file
  holds only the Greater Chennai Corporation one, under the state name `Tamil Nadu (Chennai)`. For any other
  local body, pass `professionalTax` as a number from that body's schedule. West Bengal is not in the rules
  file either: pass the amount from the state's page, or leave it out and tell the owner.
- If the rules file does not cover the month, the CLI refuses. Tell the owner which page needs re-checking
  rather than typing a rate from memory.
- TDS is never computed: ask the owner or their CA for the month's figure.
- If the establishment is not registered with EPFO or ESIC, set `pfApplicable` or `esiApplicable` to `false`
  rather than leaving a deduction the employer does not make.

## Never
- Edit files in the tools repo, or copy a rate out of it into your own notes.
- Send a slip with a made-up PAN, UAN or bank account.
- Treat a slip as a substitute for the registers the Code on Wages requires, or for the ECR filed with EPFO.
