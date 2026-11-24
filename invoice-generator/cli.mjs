#!/usr/bin/env node
// Invoice PDF from JSON, using the same index.html template people use in the browser.
// Usage and fields: node invoice-generator/cli.mjs --help   (JSON Schema: --schema)
// Next number in a series: node invoice-generator/cli.mjs --next documents/<client> [--series PREFIX] [--date YYYY-MM-DD]
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli, fail } from "../shared/cli.mjs";
import { loadRules } from "../shared/rules.mjs";
const { check, gstStateOf } = createRequire(import.meta.url)("../shared/india.js");

const RULES = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fyStart = d => { const [y, m] = d.split("-").map(Number); return m >= 4 ? y : y - 1; };
const fyLong = d => { const s = fyStart(d); return `${s}-${String(s + 1).slice(2)}`; };          // 2026-27
const fyCode = d => { const s = fyStart(d); return String(s % 100).padStart(2, "0") + String((s + 1) % 100).padStart(2, "0"); }; // 2627
const INVOICES = [undefined, "invoice", "export_invoice"];

if (args.includes("--next")) next();
else runCli({ tool: import.meta.url, dataVar: "INVOICE_DATA", check: checkDoc, name: d => d.invNo || "invoice" });

// Prints the next number in a series, PREFIX/<financial year>/NN, after the highest one already used in that
// financial year. Reads every JSON (invNo) and file name in the folder, and in all of documents/ when the folder
// is documents/<client>, so a series shared by several clients (RC/…) is never reused. Gaps are not refilled.
function next() {
  const dir = opt("--next");
  if (!dir || dir.startsWith("-")) fail("usage: --next <documents/client folder> [--series PREFIX] [--date YYYY-MM-DD]");
  const date = opt("--date") || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date must be YYYY-MM-DD");
  const here = resolve(dir), roots = [here];
  if (basename(dirname(here)) === "documents") roots.push(dirname(here));
  const seen = new Map(); // file path -> { invNo, docType, date, local }
  const walk = (d, local) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { walk(p, local); continue; }
      if (seen.has(p) && !local) continue;
      let doc = {};
      if (f.endsWith(".json")) try { doc = JSON.parse(readFileSync(p, "utf8")); } catch { console.error(`warning: ${p} is not valid JSON; skipped`); }
      seen.set(p, { file: f, invNo: doc.invNo, docType: doc.docType, date: doc.date, local: local || seen.get(p)?.local });
    }
  };
  roots.forEach((r, i) => walk(r, i === 0));
  const parse = no => String(no || "").match(/^(.+)\/(\d{4})\/(\d+)$/);
  let series = opt("--series");
  if (!series) {
    const last = [...seen.values()].filter(x => x.local && INVOICES.includes(x.docType) && parse(x.invNo))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || +parse(a.invNo)[3] - +parse(b.invNo)[3]).pop();
    if (!last) fail(`no invoice numbers like PREFIX/2627/01 in ${dir}; pass --series PREFIX (e.g. --series ACME)`);
    series = parse(last.invNo)[1];
  }
  series = series.replace(/\/+$/, "");
  const fy = fyCode(date), fileRe = new RegExp(`^${series.replace(/\//g, "_").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_${fy}_(\\d+)\\.`);
  let max = 0, width = 2;
  for (const x of seen.values()) {
    const m = parse(x.invNo), nums = [];
    if (m && m[1] === series && m[2] === fy) nums.push(m[3]);
    const fm = x.file.match(fileRe); if (fm) nums.push(fm[1]);
    for (const n of nums) { max = Math.max(max, +n); width = Math.max(width, n.length); }
  }
  console.log(`${series}/${fy}/${String(max + 1).padStart(width, "0")}`);
}

// Cross-field rules the schema cannot express. Also hands the GST state list to index.html as $gstStates.
function checkDoc(d) {
  const errs = [];
  if (d.upiQr && !d.upiId) errs.push("upiQr: is true but upiId is missing");
  for (const k of ["toGstin", "fromGstin"]) if (d[k]) { const e = check("gstin", d[k]); if (e) errs.push(`${k}: ${e}`); }
  if (d.fromGstin && /^\s*unregistered\s*$/i.test(d.fromTag || "")) errs.push("fromTag: says UNREGISTERED but fromGstin is set; change or remove fromTag");
  if (d.tdsSection) {
    const ids = [...new Set(JSON.parse(readFileSync(join(RULES, "tds-sections.json"), "utf8")).entries.map(e => e.id))];
    if (!ids.includes(d.tdsSection)) errs.push(`tdsSection: "${d.tdsSection}" is not an id in rules/tds-sections.json (${ids.join(", ")})`);
  }
  const date = d.date || today(), X = d.docType === "export_invoice";
  let states = null, stateErr = null;
  try { states = loadRules("gst-state-codes", date).entries; } catch (e) { stateErr = e.message; }
  if (states) d.$gstStates = states; // runCli passes this object to the page; keys starting with $ are not validated
  const seller = d.fromGstin && states ? gstStateOf(d.fromGstin.trim().slice(0, 2), states) : null;
  if (d.fromGstin && states && !seller) errs.push(`fromGstin: state code ${d.fromGstin.slice(0, 2)} is not in rules/gst-state-codes.json`);
  if (!X && d.taxMode === "auto" && d.fromGstin) {
    if (!states) errs.push(`taxMode auto: ${stateErr}`);
    else if (!gstStateOf(d.place, states)) errs.push(`place: "${d.place ?? ""}" is not a state name or GST state code in rules/gst-state-codes.json (needed by taxMode auto)`);
  }
  if (!X && seller && (d.taxMode === "cgst_sgst" || d.taxMode === "igst")) {
    const p = gstStateOf(d.place, states);
    if (p && (p.code === seller.code) !== (d.taxMode === "cgst_sgst"))
      console.error(`warning: taxMode ${d.taxMode} but the seller is in ${seller.name} and the place of supply is ${p.name}; taxMode auto would pick ${p.code === seller.code ? "cgst_sgst" : "igst"}`);
  }
  if (X) {
    // An unregistered seller issues a plain invoice: no Rule 46 endorsement, LUT or IGST, but still the rupee value.
    const registered = !!d.fromGstin, lutSet = d.lut && Object.values(d.lut).some(v => v);
    for (const k of ["currency", "exchangeRate", "exchangeRateSource", "exchangeRateDate", "buyerCountry", ...(registered ? ["exportMode"] : [])])
      if (d[k] === undefined || d[k] === "") errs.push(`${k}: is required on an export invoice`);
    if (d.exchangeRate === 0) errs.push("exchangeRate: must be more than 0");
    if (!registered && (d.exportMode || lutSet))
      errs.push(`${d.exportMode ? "exportMode" : "lut"}: remove it; the Rule 46 export endorsement and a Letter of Undertaking apply only to GST-registered sellers (set fromGstin if you are registered)`);
    if (registered && d.exportMode === "lut") {
      if (!d.lut?.arn || !d.lut?.fy) errs.push("lut: exportMode lut needs lut.arn and lut.fy");
      else if (d.lut.fy !== fyLong(date)) errs.push(`lut.fy: is ${d.lut.fy} but the invoice is dated in ${fyLong(date)}; an LUT is valid only for the financial year it is furnished for (CBIC Circular 8/8/2017-GST)`);
    }
  }
  return errs.length ? errs.join("\n       ") : null;
}
