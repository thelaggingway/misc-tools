#!/usr/bin/env node
// Wage slip PDF from JSON, using the same index.html template people use in the browser.
// Usage and fields: node salary-slip/cli.mjs --help   (JSON Schema: --schema)
import { createRequire } from "node:module";
import { runCli } from "../shared/cli.mjs";
import { loadRules } from "../shared/rules.mjs";
const require = createRequire(import.meta.url);
const { check } = require("../shared/india.js");
const { deductions, monthStart, monthEnd, daysInMonth } = require("../shared/payroll.js");

// The rule entries that can apply anywhere in this month, so a month that spans a rate change is
// priced by days at each rate. loadRules refuses a month the file does not vouch for.
function rulesForMonth(name, month) {
  const first = loadRules(name, monthStart(month)), last = loadRules(name, monthEnd(month));
  const seen = new Set(), entries = [];
  for (const e of [...first.entries, ...last.entries]) {
    const key = JSON.stringify(e);
    if (!seen.has(key)) { seen.add(key); entries.push(e); }
  }
  return { entries, checkedOn: first.checkedOn, coverage: first.coverage, sources: first.sources };
}

runCli({
  tool: import.meta.url,
  dataVar: "SALARY_DATA",
  check: d => {
    const errs = [];
    if (!d.month) errs.push("month: is required, as YYYY-MM");
    if (d.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.month)) errs.push(`month: "${d.month}" is not a month as YYYY-MM`);
    if (d.pan) { const e = check("pan", d.pan); if (e) errs.push("pan: " + e); }
    if (d.ifsc) { const e = check("ifsc", d.ifsc); if (e) errs.push("ifsc: " + e); }
    if (d.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(d.month)) {
      const total = daysInMonth(d.month);
      for (const k of ["daysPaid", "lopDays"])
        if (d[k] !== undefined && Number(d[k]) > total) errs.push(`${k}: ${d[k]} is more than the ${total} days in ${d.month}`);
    }
    if (errs.length) return errs.join("\n       ");
    if (!d.autoDeductions) return null;
    try {
      Object.assign(d, deductions(d, {
        pfEsi: rulesForMonth("pf-esi", d.month),
        professionalTax: rulesForMonth("professional-tax", d.month),
      }));
    } catch (e) { return "autoDeductions: " + e.message; }
    return null;
  },
  name: d => d.slipNo || `wage-slip-${(d.employeeName || "employee").toLowerCase().replace(/\s+/g, "-")}-${d.month || ""}`,
});
