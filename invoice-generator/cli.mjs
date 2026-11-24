#!/usr/bin/env node
// Render an invoice PDF from JSON, using the same index.html template humans use.
// Usage: node cli.mjs [profile.json] invoice.json [-o out.pdf]
// JSON files merge left to right; "-" reads JSON from stdin. Needs Chrome or Chromium (set CHROME_PATH if it isn't found).
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEYS = ["fromName", "fromAddress", "fromTag", "toName", "toAddress", "invNo", "date", "due", "place",
  "items", "taxMode", "taxRate", "bankName", "bank", "acct", "ifsc", "terms", "footer", "signName",
  "docType", "refInvoice", "refDate", "payMode", "payRef", "notes", "upiQr", "upiId", "upiName"];
const DOC_TYPES = ["invoice", "proforma", "quotation", "receipt", "credit_note", "debit_note"];
const ITEM_KEYS = ["desc", "sac", "qty", "unit", "rate"];

function fail(msg) { console.error("error: " + msg); process.exit(1); }

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(readFileSync(new URL("./README.md", import.meta.url), "utf8")); process.exit(0);
}
let out, files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" || args[i] === "--out") out = args[++i];
  else files.push(args[i]);
}

const data = {};
for (const f of files) {
  const text = f === "-" ? readFileSync(0, "utf8") : readFileSync(f, "utf8");
  try { Object.assign(data, JSON.parse(text)); } catch (e) { fail(`${f} is not valid JSON: ${e.message}`); }
}
for (const k of Object.keys(data)) if (!KEYS.includes(k)) fail(`unknown field "${k}". Allowed: ${KEYS.join(", ")}`);
if (data.items !== undefined) {
  if (!Array.isArray(data.items) || !data.items.length) fail(`"items" must be a non-empty array`);
  data.items.forEach((it, n) => {
    for (const k of Object.keys(it)) if (!ITEM_KEYS.includes(k)) fail(`items[${n}]: unknown field "${k}". Allowed: ${ITEM_KEYS.join(", ")}`);
    if (!Number.isFinite(Number(it.rate)) || !Number.isFinite(Number(it.qty ?? 1))) fail(`items[${n}]: qty and rate must be numbers`);
  });
}
if (data.taxMode && !["none", "cgst_sgst", "igst"].includes(data.taxMode)) fail(`taxMode must be none, cgst_sgst or igst`);
if (data.docType && !DOC_TYPES.includes(data.docType)) fail(`docType must be one of ${DOC_TYPES.join(", ")}`);
if (data.upiQr !== undefined && typeof data.upiQr !== "boolean") fail(`upiQr must be true or false`);
if (data.upiQr && !data.upiId) fail(`upiQr is true but upiId is missing`);
if (data.upiId && !/^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/.test(data.upiId)) fail(`upiId "${data.upiId}" is not a UPI ID like name@bank`);
for (const k of ["date", "due", "refDate"]) if (data[k] && !/^\d{4}-\d{2}-\d{2}$/.test(data[k])) fail(`${k} must be YYYY-MM-DD`);

out = resolve(out || (data.invNo || "invoice").replace(/[\/\\]/g, "_") + ".pdf");

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
  for (const n of names) { try { return execFileSync("which", [n], { encoding: "utf8" }).trim(); } catch {} }
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  const ab = join(homedir(), ".agent-browser/browsers"); // Amp orbs ship Chrome for agent-browser here
  if (existsSync(ab)) for (const d of readdirSync(ab)) if (existsSync(join(ab, d, "chrome"))) return join(ab, d, "chrome");
  fail("Chrome/Chromium not found. Install it or set CHROME_PATH.");
}

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8")
  .replace("</head>", `<script>window.INVOICE_DATA = ${JSON.stringify(data).replace(/</g, "\\u003c")};</script></head>`);
const tmp = mkdtempSync(join(tmpdir(), "invoice-"));
const page = join(tmp, "invoice.html");
writeFileSync(page, html);
try {
  execFileSync(findChrome(), ["--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
    `--user-data-dir=${join(tmp, "profile")}`, `--print-to-pdf=${out}`, "file://" + page], { stdio: "ignore" });
} catch (e) { fail("Chrome failed to print the PDF: " + e.message); }
finally { rmSync(tmp, { recursive: true, force: true }); }
if (!existsSync(out)) fail("Chrome exited without writing the PDF");
console.log(out);
