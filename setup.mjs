#!/usr/bin/env node
// Turn any folder into a misc-tools workspace, or refresh one after updating the tools:
//   node /path/to/misc-tools/setup.mjs /path/to/your/workspace
// The workspace holds your own data (profiles, clients, documents) and can be a private git repo,
// a Google Drive or Dropbox folder, or a plain folder. Your agent works there; this repo stays read-only.
// Re-run after every `git pull` of misc-tools, and after moving the workspace to another computer.
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tools = dirname(fileURLToPath(import.meta.url));
const ws = resolve(process.argv[2] || "");
if (!process.argv[2]) { console.log("usage: node setup.mjs <workspace-folder>"); process.exit(1); }
if (ws === tools || ws.startsWith(tools + "/")) { console.error("error: keep the workspace outside the misc-tools folder"); process.exit(1); }

for (const d of ["profiles", "clients", "documents"]) mkdirSync(join(ws, d), { recursive: true });

// Skills: one copy per agent folder (.agents/skills for Amp and Codex, .claude/skills for Claude Code).
// Copies, not links, so they survive cloud-drive sync and Windows checkouts.
const cfgPath = join(ws, "misc-tools.json");
const old = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
const skills = readdirSync(join(tools, "skills")).filter(s => existsSync(join(tools, "skills", s, "SKILL.md")));
for (const base of [".agents/skills", ".claude/skills"]) {
  for (const s of old.skills || []) rmSync(join(ws, base, s), { recursive: true, force: true });
  for (const s of skills) cpSync(join(tools, "skills", s), join(ws, base, s), { recursive: true });
}
writeFileSync(cfgPath, JSON.stringify({ ...old, toolsPath: tools, skills }, null, 2) + "\n");

// AGENTS.md: refresh only the block between the markers, so the user's own notes stay.
const START = "<!-- misc-tools:start (setup.mjs rewrites this block) -->", END = "<!-- misc-tools:end -->";
const block = `${START}
# Business workspace (misc-tools)

This folder holds the owner's business records. The tools that make documents live in a separate,
read-only checkout at the \`toolsPath\` in \`misc-tools.json\`; never edit files there. Use the skills in
\`.agents/skills/\` (\`.claude/skills/\` for Claude Code); each one says which tool to run and how.

- \`profiles/\`: the owner's own details (name, address, GSTIN, bank, UPI), usually \`profiles/me.json\`.
- \`clients/<client>.json\`: one file per client. Create them with the client-intake skill.
- \`documents/<client>/<number>.json\` and \`.pdf\`: every invoice, quote, receipt or note, input next to output.

Rules:
- A sent document is final. Never edit, overwrite or reuse its number; fix mistakes with a credit or debit note.
- Before saving anything that depends on a tax rule, code or rate (GST, TDS, SAC/HSN, state codes), open the
  official source link the tool or rule file gives and confirm it. Say what you checked. If you cannot check,
  tell the owner instead of guessing.
- Show the owner the finished PDF (or a picture of it) and ask before treating it as sent.
- If this folder is a git repository, commit each finished document (its JSON and PDF together).
${END}`;
const agentsPath = join(ws, "AGENTS.md");
let agents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
const i = agents.indexOf(START), j = agents.indexOf(END);
agents = i >= 0 && j > i ? agents.slice(0, i) + block + agents.slice(j + END.length) : block + (agents ? "\n\n" + agents : "") + "\n";
writeFileSync(agentsPath, agents);
const claudePath = join(ws, "CLAUDE.md");
if (!existsSync(claudePath)) writeFileSync(claudePath, "Read and follow AGENTS.md in this folder.\n\n@AGENTS.md\n");

console.log(`workspace ready: ${ws}\ntools: ${tools}\nskills: ${skills.join(", ")}`);
