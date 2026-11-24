#!/usr/bin/env node
// Find the SAC (services) or HSN (goods) code and GST rate for something you bill:
//   node shared/lookup.mjs sac consulting        node shared/lookup.mjs sac 998313
//   node shared/lookup.mjs hsn 0902              node shared/lookup.mjs hsn tea
// Searches rules/sac-codes.json or rules/hsn-common.json by code or words (English and Hinglish), prints
// every match with the official page that states it, and exits 1 when nothing matches.
// A match is a lead, not a conclusion: open the printed page and read the entry before putting the code
// on a document. This prints rates only; whether a supply is exempt, or who pays under reverse charge,
// comes from the exemption and reverse-charge notifications, not from here.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");
const KINDS = {
  sac: { file: "sac-codes.json", label: "SAC", code: "code" },
  hsn: { file: "hsn-common.json", label: "HSN", code: "hsn" },
};
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const kind = KINDS[(args[0] || "").toLowerCase()];
if (!kind || !args[1]) {
  console.log("usage: node shared/lookup.mjs <sac|hsn> <code or words>");
  console.log("  node shared/lookup.mjs sac consulting");
  console.log("  node shared/lookup.mjs hsn 0902");
  process.exit(args.length ? 1 : 0);
}

const rules = JSON.parse(readFileSync(join(RULES_DIR, kind.file), "utf8"));
const sourceOf = id => rules.sources.find(s => s.id === id) || {};
const q = args.slice(1).join(" ").trim().toLowerCase();
const digits = q.replace(/\D/g, "");
const tokens = q.split(/\s+/).filter(Boolean);
// "4819 10, 4819 20" and "5208 to 5212" hold several codes; compare against each.
const codesOf = e => String(e[kind.code]).split(/,|\bto\b/).map(s => s.replace(/\D/g, "")).filter(Boolean);
// Whole words are compared as tokens, not with a /\b...\b/ pattern: written inside a template literal with a
// single backslash, \b is the backspace escape, so the pattern matches U+0008 and never matches a word.
const wordsIn = s => new Set(s.split(/[^a-z0-9]+/).filter(Boolean));

const hits = [];
for (const e of rules.entries) {
  const codes = codesOf(e);
  const words = (e.search || []).map(s => s.toLowerCase());
  const text = `${e.description || e.service} ${words.join(" ")}`.toLowerCase();
  const textWords = wordsIn(text);
  let score = 0;
  if (digits.length >= 2 && codes.includes(digits)) score = 100;
  else if (digits.length === 4 && codes.length === 2 && codes.every(c => c.length === 4)
    && codes[0] <= digits && digits <= codes[1]) score = 90;
  else if (digits.length >= 2 && codes.some(c => c.startsWith(digits))) score = 80;
  else if (words.includes(q)) score = 70;
  else if (q.length >= 2 && words.some(w => w.startsWith(q))) score = 60;
  else if (q.length >= 3 && tokens.every(t => textWords.has(t))) score = 40;
  if (score) hits.push({ e, score });
}
hits.sort((a, b) => b.score - a.score || String(a.e[kind.code]).localeCompare(String(b.e[kind.code])));

if (!hits.length) {
  console.error(`No ${kind.label} code or word matched "${q}".`);
  console.error(`Try a broader word (${kind.label === "SAC" ? "consulting, software, design, rent, legal" : "tea, soap, furniture, mobile"}) or the code itself.`);
  console.error(`The full list is rules/${kind.file}; the official schedule is ${rules.sources[0].url}`);
  process.exit(1);
}

console.log(`${hits.length} ${hits.length === 1 ? "match" : "matches"} for "${q}" in rules/${kind.file} (checked ${rules.checked_on}):\n`);
for (const { e } of hits) {
  const until = e.effective_to ? `to ${e.effective_to}` : "onwards";
  console.log(`${e[kind.code]}  ${e.description || e.service}`);
  console.log(`  GST ${e.rate}%${e.schedule ? `  ${e.schedule}` : ""}${e.rate_note ? `  (${e.rate_note})` : ""}`);
  console.log(`  In force from ${e.effective_from} ${until}`);
  if (e.note) console.log(`  Note: ${e.note}`);
  if (e.unverified) console.log(`  Unverified: not confirmed against the source; check it before use.`);
  const s = sourceOf(e.source);
  console.log(`  Confirm: ${s.title}\n           ${s.url}\n`);
}
if (today < rules.coverage.from || today > rules.coverage.to) {
  console.log(`Warning: this file covers ${rules.coverage.from} to ${rules.coverage.to}, not today (${today}). Check the source before using it.`);
} else {
  console.log(`Confirm the entry on the page above before you use it. Rates here are total GST; the notification states central tax.`);
}
