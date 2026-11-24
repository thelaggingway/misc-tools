// Shared command-line runner for document tools: merge JSON inputs, validate them against the tool's
// schema.json, render the tool's index.html with that data in headless Chrome, and write a PDF.
//
//   node <tool>/cli.mjs [file.json ...] [-o out.pdf]   files merge left to right; "-" reads stdin
//   node <tool>/cli.mjs --help                         prints the tool's README
//   node <tool>/cli.mjs --schema                       prints the tool's JSON Schema
//   node <tool>/cli.mjs --check [file.json ...]        validates only, writes nothing
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function fail(msg) { console.error("error: " + msg); process.exit(1); }

// A small JSON Schema subset: type, enum, pattern, format "date", minimum, minItems, properties,
// required, additionalProperties: false, items. Returns a list of "path: problem" strings.
export function validate(schema, value, path = "") {
  const errs = [], at = path || "(top level)";
  const types = [].concat(schema.type || []);
  const typeOf = v => Array.isArray(v) ? "array" : v === null ? "null" : typeof v === "number" ? "number" : typeof v;
  if (types.length && !types.includes(typeOf(value))) return [`${at}: must be ${types.join(" or ")}, got ${typeOf(value)}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${value}" does not match ${schema.description || schema.pattern}`);
    if (schema.format === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) errs.push(`${at}: must be a date as YYYY-MM-DD`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} entr${schema.minItems > 1 ? "ies" : "y"}`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  if (typeOf(value) === "object" && schema.properties) {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path ? path + "." : ""}${k}: is required`);
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (schema.properties[k]) errs.push(...validate(schema.properties[k], v, p));
      else if (schema.additionalProperties === false && !k.startsWith("$"))
        errs.push(`${p}: unknown field. Allowed: ${Object.keys(schema.properties).join(", ")}`);
    }
  }
  return errs;
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"]) {
    try { return execFileSync("which", [n], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
  }
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]) if (existsSync(p)) return p;
  const ab = join(homedir(), ".agent-browser/browsers"); // Amp orbs ship Chrome for agent-browser here
  if (existsSync(ab)) for (const d of readdirSync(ab)) if (existsSync(join(ab, d, "chrome"))) return join(ab, d, "chrome");
  fail("Chrome/Chromium not found. Install it or set CHROME_PATH.");
}

// Inline ../shared/*.js script tags so the page works from a temp directory, then inject the data.
export function pageWithData(toolDir, dataVar, data) {
  return readFileSync(join(toolDir, "index.html"), "utf8")
    .replace(/<script src="\.\.\/shared\/([\w./-]+)"><\/script>/g,
      (_, f) => `<script>${readFileSync(join(toolDir, "..", "shared", f), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`)
    .replace("</head>", `<script>window.${dataVar} = ${JSON.stringify(data).replace(/</g, "\\u003c")};</script></head>`);
}

export function printPdf(html, out) {
  const tmp = mkdtempSync(join(tmpdir(), "misc-tools-"));
  const page = join(tmp, "page.html");
  writeFileSync(page, html);
  try {
    execFileSync(findChrome(), ["--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
      `--user-data-dir=${join(tmp, "profile")}`, `--print-to-pdf=${out}`, "file://" + page], { stdio: "ignore" });
  } catch (e) { fail("Chrome failed to print the PDF: " + e.message); }
  finally { rmSync(tmp, { recursive: true, force: true }); }
  if (!existsSync(out)) fail("Chrome exited without writing the PDF");
}

// tool: the tool's cli.mjs import.meta.url. dataVar: the window variable index.html reads.
// check(data): extra cross-field rules, returns a message or null. name(data): default file name.
export function runCli({ tool, dataVar, check = () => null, name = () => "output" }) {
  const toolDir = dirname(fileURLToPath(tool));
  const schema = JSON.parse(readFileSync(join(toolDir, "schema.json"), "utf8"));
  const args = process.argv.slice(2);
  if (!args.length || args.includes("-h") || args.includes("--help")) { console.log(readFileSync(join(toolDir, "README.md"), "utf8")); return; }
  if (args.includes("--schema")) { console.log(JSON.stringify(schema, null, 2)); return; }
  let out; const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--out") out = args[++i];
    else if (args[i] !== "--check") files.push(args[i]);
  }
  const data = {};
  for (const f of files) {
    let text;
    try { text = f === "-" ? readFileSync(0, "utf8") : readFileSync(f, "utf8"); } catch (e) { fail(`cannot read ${f}: ${e.message}`); }
    try { Object.assign(data, JSON.parse(text)); } catch (e) { fail(`${f} is not valid JSON: ${e.message}`); }
  }
  for (const k of Object.keys(data)) if (k.startsWith("$")) delete data[k];
  const errs = validate(schema, data);
  const extra = check(data); if (extra) errs.push(extra);
  if (errs.length) fail(errs.join("\n       "));
  if (args.includes("--check")) { console.log("ok"); return; }
  out = resolve(out || name(data).replace(/[\/\\:*?"<>|]/g, "_") + ".pdf");
  printPdf(pageWithData(toolDir, dataVar, data), out);
  console.log(out);
}
