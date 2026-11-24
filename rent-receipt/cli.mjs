#!/usr/bin/env node
// Rent receipts (one per month) as a PDF, using the same index.html template people use in the browser.
// Usage and fields: node rent-receipt/cli.mjs --help   (JSON Schema: --schema)
import { createRequire } from "node:module";
import { runCli } from "../shared/cli.mjs";
import { loadRules } from "../shared/rules.mjs";
const require = createRequire(import.meta.url);
const { check } = require("../shared/india.js");
const { monthsBetween } = require("../shared/payroll.js");

const monthsOf = d => (d.months || []).length ? d.months : (d.from && d.to ? monthsBetween(d.from, d.to) : []);

runCli({
  tool: import.meta.url,
  dataVar: "RENT_DATA",
  check: d => {
    const errs = [];
    const months = monthsOf(d);
    if (!months.length) errs.push("months: give at least one month as YYYY-MM, or a from and to range");
    if (d.from && d.to && d.from > d.to) errs.push(`from: ${d.from} is after to ${d.to}`);
    if (!(Number(d.rent) > 0)) errs.push("rent: is required, as a monthly amount");
    if (d.landlordPan) { const e = check("pan", d.landlordPan); if (e) errs.push("landlordPan: " + e); }
    if (errs.length) return errs.join("\n       ");

    // The two thresholds that decide the shape of the receipt: the landlord's PAN, and the revenue
    // stamp on a cash receipt. Both come from rules/hra-rent.json, which refuses a month it does not cover.
    let rules;
    try { rules = loadRules("hra-rent", months[0] + "-01"); } catch (e) { return e.message; }
    const pan = rules.entries.find(e => e.kind === "landlord_pan");
    const stamp = rules.entries.find(e => e.kind === "revenue_stamp");
    const annual = Number(d.rent) * 12;
    if (pan && annual > pan.threshold && !d.landlordPan)
      errs.push(`landlordPan: required — rent of ₹${annual} a year is above ₹${pan.threshold} (${pan.form}). Ask the landlord for it, or explain why it cannot be given.`);
    d.stampRequired = !!stamp && /cash/i.test(d.paymentMode || "") && Number(d.rent) > stamp.threshold;
    return errs.length ? errs.join("\n       ") : null;
  },
  name: d => {
    const months = monthsOf(d);
    return `rent-receipt-${(d.tenantName || "tenant").toLowerCase().replace(/\s+/g, "-")}-${months[0] || ""}-${months[months.length - 1] || ""}`;
  },
});
