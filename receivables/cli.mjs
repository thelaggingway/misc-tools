#!/usr/bin/env node
// Who owes what: reads every document in a workspace and prints receivables, ageing, TDS and reminder drafts.
// Usage: node receivables/cli.mjs <workspace> [--as-of YYYY-MM-DD] [--json] [--payee individual|other] [-o report.pdf]
// Details: --help (prints README.md); fields it reads: --schema
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, validate, pageWithData, printPdf } from "../shared/cli.mjs";
import { lintRules } from "../shared/rules.mjs";
const require = createRequire(import.meta.url);
const { inr, fmtDate } = require("../shared/india.js");
const { buildReport, money } = require("./receivables.js");

const toolDir = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(toolDir, "schema.json"), "utf8"));
const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) { console.log(readFileSync(join(toolDir, "README.md"), "utf8")); process.exit(0); }
if (args.includes("--schema")) { console.log(JSON.stringify(schema, null, 2)); process.exit(0); }

let ws, asOf = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), json = false, out, payee = "individual_huf";
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--as-of") asOf = args[++i];
  else if (a === "--json") json = true;
  else if (a === "-o" || a === "--out") out = args[++i];
  else if (a === "--payee") payee = { individual: "individual_huf", huf: "individual_huf", individual_huf: "individual_huf", other: "other" }[args[++i]] || fail("--payee must be individual or other");
  else if (a.startsWith("-")) fail(`unknown option ${a}`);
  else ws = resolve(a);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf || "") || isNaN(Date.parse(asOf))) fail("--as-of must be a date as YYYY-MM-DD");
if (!ws || !existsSync(join(ws, "documents"))) fail(`${ws || "(none)"} is not a workspace: it has no documents/ folder`);

const readJson = f => { try { return JSON.parse(readFileSync(f, "utf8")); } catch (e) { fail(`${f}: ${e.message}`); } };
const jsonFiles = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith(".json")).sort() : [];
const byName = d => Object.fromEntries(jsonFiles(d).map(f => [basename(f, ".json"), readJson(join(d, f))]));
const profiles = byName(join(ws, "profiles")), clients = byName(join(ws, "clients"));
const documents = [], errs = [];
for (const c of readdirSync(join(ws, "documents"), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
  for (const f of jsonFiles(join(ws, "documents", c))) {
    const data = readJson(join(ws, "documents", c, f));
    errs.push(...validate(schema, data).map(e => `documents/${c}/${f}: ${e}`));
    documents.push({ client: c, file: f, data });
  }
for (const [n, c] of Object.entries(clients)) errs.push(...validate(schema, c).map(e => `clients/${n}.json: ${e}`));
if (errs.length) fail(errs.join("\n       "));

const rules = readJson(join(toolDir, "..", "rules", "tds-sections.json"));
const ruleErrs = lintRules("tds-sections.json", rules);
if (ruleErrs.length) fail(ruleErrs.join("\n       "));

const report = buildReport({ profiles, clients, documents, rules, asOf, payee });
report.workspace = ws;

if (out) {
  out = resolve(out);
  const html = pageWithData(toolDir, "RECEIVABLES_DATA", report)
    .replace('<script src="receivables.js"></script>', () => `<script>${readFileSync(join(toolDir, "receivables.js"), "utf8")}</script>`);
  printPdf(html, out);
  console.log(out);
} else if (json) console.log(JSON.stringify(report, null, 2));
else console.log(text(report));

function text(r) {
  const L = [], s = r.summary, B = { not_due: "Not yet due", "0-30": "0-30 days", "31-60": "31-60 days", "61-90": "61-90 days", "90+": "90+ days" };
  L.push(`# Receivables as of ${fmtDate(r.asOf)}`, "");
  L.push(`Outstanding: ${inr(s.outstandingInr)} on ${s.open} invoice(s) from ${s.clients} client(s); ${s.paid} fully settled.` +
    (s.unconverted.length ? ` Not in the total (foreign currency, no exchangeRate): ${s.unconverted.join(", ")}.` : ""));
  L.push("Days past due: " + Object.entries(B).map(([k, v]) => `${v} ${inr(s.buckets[k])}`).join(" | "), "");
  if (r.open.length) {
    L.push("## Unpaid and part-paid", "");
    for (const i of r.open) {
      L.push(`- ${i.clientName} · ${i.number} · dated ${fmtDate(i.date)} · due ${fmtDate(i.due)}${i.dueGiven ? "" : " (no due date; taken as the invoice date)"} · ` +
        `${i.daysPastDue < 0 ? `due in ${-i.daysPastDue} days` : `${i.daysPastDue} days past due`} [${B[i.bucket]}]`);
      L.push(`  ${i.status}: total ${money(i.total, i.currency)}, received ${money(i.received, i.currency)}, TDS ${money(i.tds, i.currency)}, credit notes ${money(i.credited, i.currency)}, balance ${money(i.balance, i.currency)}` +
        (i.currency !== "INR" && i.balanceInr != null ? ` (≈ ${inr(i.balanceInr)} at ${i.exchangeRate})` : ""));
    }
    L.push("");
  }
  if (r.exports.length) {
    L.push("## Export invoices: FEMA realisation deadline", `${r.fema.basis} Source: ${r.fema.cite}, ${r.fema.url}`, "");
    for (const i of r.exports) L.push(`- ${i.clientName}${i.buyerCountry ? ` (${i.buyerCountry})` : ""} · ${i.number} · ${money(i.total, i.currency)} · ` +
      (i.fema.realised ? "realised" : `${money(i.balance, i.currency)} unrealised; realise by ${fmtDate(i.fema.deadline)} (${i.fema.daysLeft < 0 ? `${-i.fema.daysLeft} days late: ask your bank about an extension` : `${i.fema.daysLeft} days left`})`) +
      (i.fema.note ? `\n  ${i.fema.note}` : ""));
    L.push("");
  }
  L.push("## TDS deducted by clients (match against Form 26AS / AIS)", "");
  if (!r.tdsByClient.length) L.push("None recorded.");
  for (const g of r.tdsByClient) L.push(`- FY ${g.fy} · ${g.clientName}: TDS ${inr(g.tds)} on ${inr(g.gross)} settled over ${g.receipts} receipt(s)${g.sections.length ? ` · section ${g.sections.join(", ")}` : ""}`);
  L.push("");
  if (r.tdsChecks.length) {
    L.push("## TDS checks", r.tdsRules ? `rules/tds-sections.json checked ${r.tdsRules.checkedOn}, covers ${r.tdsRules.coverage.from} to ${r.tdsRules.coverage.to}. Confirm on the official source before telling the owner.` : "", "");
    for (const c of r.tdsChecks) L.push(`- [${c.level}] ${c.clientName}, ${c.at}: ${c.msg}${c.source ? ` (${c.source})` : ""}`);
    L.push("");
  }
  if (r.unapplied.length || r.problems.length || r.laterDocuments.length) {
    L.push("## Needs attention", "");
    for (const p of r.unapplied) L.push(`- ${p.file}: ${p.type.replace("_", " ")} ${p.number} for ${money(p.amount, p.currency)} ${p.why}; not counted against any invoice`);
    for (const p of r.problems) L.push(`- ${p}`);
    if (r.laterDocuments.length) L.push(`- Dated after ${fmtDate(r.asOf)}, left out: ${r.laterDocuments.join(", ")}`);
    L.push("");
  }
  if (r.reminders.length) {
    L.push("## Reminder drafts (not sent; show the owner before anything goes out)", "");
    for (const m of r.reminders) {
      L.push(`### ${m.clientName} (${m.invoices.join(", ")}; up to ${m.daysPastDue} days past due)`, "", "WhatsApp:", "```", m.whatsapp, "```", "",
        `Email subject: ${m.email_draft.subject}`, "```", m.email_draft.body, "```", "");
    }
  }
  return L.join("\n");
}
