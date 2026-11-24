#!/usr/bin/env node
// Load dated rule files from rules/ (format: rules/README.md), and check them all.
//   import { loadRules } from "../shared/rules.mjs";
//   const { entries, sources, checkedOn } = loadRules("tds-sections", "2026-11-24");
//   node shared/rules.mjs            checks every rules/*.json file and lists what each covers
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Problems with a rule file's structure, as "file: problem" strings.
export function lintRules(file, r) {
  const errs = [], e = m => errs.push(`${file}: ${m}`);
  for (const k of ["name", "description"]) if (typeof r[k] !== "string" || !r[k]) e(`"${k}" must be a non-empty string`);
  if (!DATE.test(r.checked_on || "")) e(`"checked_on" must be YYYY-MM-DD (the day someone compared the file with its sources)`);
  if (!DATE.test(r.coverage?.from || "") || !DATE.test(r.coverage?.to || "")) e(`"coverage.from" and "coverage.to" must be YYYY-MM-DD`);
  if (!Array.isArray(r.sources) || !r.sources.length) e(`"sources" must list at least one official source`);
  (r.sources || []).forEach((s, i) => {
    if (!s.id || !s.title || !/^https:\/\//.test(s.url || "")) e(`sources[${i}] needs id, title and an https url`);
  });
  const ids = new Set((r.sources || []).map(s => s.id));
  if (!Array.isArray(r.entries) || !r.entries.length) e(`"entries" must be a non-empty array`);
  (r.entries || []).forEach((x, i) => {
    if (!ids.has(x.source)) e(`entries[${i}].source "${x.source}" is not one of the source ids`);
    for (const k of ["effective_from", "effective_to"]) if (x[k] != null && !DATE.test(x[k])) e(`entries[${i}].${k} must be YYYY-MM-DD or null`);
  });
  return errs;
}

// Entries in force on `date`. Throws when the file does not vouch for that date, so a tool never
// silently applies an old or not-yet-checked rate.
export function loadRules(name, date = new Date().toISOString().slice(0, 10)) {
  const file = `${name}.json`;
  const r = JSON.parse(readFileSync(join(RULES_DIR, file), "utf8"));
  const errs = lintRules(file, r);
  if (errs.length) throw new Error(errs.join("\n"));
  if (date < r.coverage.from || date > r.coverage.to)
    throw new Error(`rules/${file} covers ${r.coverage.from} to ${r.coverage.to}, not ${date}. Check the sources listed in it and update the file before using it for this date.`);
  const entries = r.entries.filter(x => (x.effective_from ?? "0000") <= date && date <= (x.effective_to ?? "9999"));
  return { entries, sources: r.sources, checkedOn: r.checked_on, coverage: r.coverage,
    sourceOf: x => r.sources.find(s => s.id === x.source) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0;
  for (const f of readdirSync(RULES_DIR).filter(f => f.endsWith(".json")).sort()) {
    let r; try { r = JSON.parse(readFileSync(join(RULES_DIR, f), "utf8")); } catch (err) { console.log(`${f}: not valid JSON: ${err.message}`); bad++; continue; }
    const errs = lintRules(f, r);
    if (errs.length) { bad++; errs.forEach(x => console.log(x)); }
    else console.log(`${f}: ok, ${r.entries.length} entries, covers ${r.coverage.from} to ${r.coverage.to}, checked ${r.checked_on}`);
  }
  process.exit(bad ? 1 : 0);
}
