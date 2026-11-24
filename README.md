# misc-tools

Agent-first business paperwork for Indian freelancers and small businesses: invoices, quotations, receipts,
credit notes and more, generated on your own computer. Ask your AI agent in plain language ("invoice Acme
for November", or a screenshot of a client's address), and it uses these tools to make the document, checks
tax details against official sources, and files it in your own records. Every tool also has a browser form
for doing it by hand.

Works with Claude Code, Codex and Amp. Free, offline, MIT licensed. Nothing is sent to a server.

## How it fits together

Two folders, kept apart:

| Folder | What it holds | Who changes it |
|---|---|---|
| **misc-tools** (this repo, or your fork) | Tools, templates, skills, rule files with official sources | Nobody; you just update it now and then |
| **Your workspace** | Your profile, clients, and every document you make (JSON + PDF) | You and your agent |

Your workspace can be a **private git repository** (best if you use git: full history), a **Google Drive,
OneDrive or Dropbox folder** (synced and backed up, no git needed), or **any folder on your computer**.

## Setup (once)
Needs [Node.js](https://nodejs.org) 18 or newer and Google Chrome (or Chromium).

```sh
git clone https://github.com/thelaggingway/misc-tools.git      # or fork it first and clone your fork
node misc-tools/setup.mjs ~/my-business                         # any folder: a private repo, a Drive folder, ...
```

`setup.mjs` creates `profiles/`, `clients/` and `documents/` in the workspace, records where the tools are
(`misc-tools.json`), and installs the skills where each agent looks for them (`.agents/skills/` for Amp and
Codex, `.claude/skills/` for Claude Code) with an `AGENTS.md` (and a `CLAUDE.md` pointing to it).

Then open your agent **in the workspace** and start with "set up my profile" and "add a client" (a screenshot
works). From then on, ask for documents.

## Staying up to date
```sh
git -C misc-tools pull                 # or "Sync fork" on GitHub, then pull
node misc-tools/setup.mjs ~/my-business  # refreshes the skills and AGENTS.md block; your data is untouched
```
Re-run `setup.mjs` too if you move the workspace to another computer (it records the tools' path).

## Tools

| Tool | Makes | Agent skill |
|---|---|---|
| [invoice-generator](invoice-generator/) | Invoice, proforma, quotation, payment receipt, credit note, debit note (A4 PDF, GST, amount in words, UPI QR) | `misc-tools-invoices` |
| (intake) | Client and profile files from a screenshot or text, with GSTIN/PAN/IFSC/PIN checks | `misc-tools-client-intake` |
| [salary-slip](salary-slip/) | Monthly wage slip: days paid, earnings, PF/ESI/professional tax from the dated rules, net in words (A4 PDF) | `misc-tools-salary-slip` |
| [rent-receipt](rent-receipt/) | Rent receipts for an HRA claim, one per month, with the landlord's PAN and a revenue stamp box on cash months (A4 PDF) | `misc-tools-rent-receipt` |

To use a tool by hand, open its `index.html` in a browser, fill in the form and click **Download PDF**.
Helpers: `node shared/check.mjs gstin <GSTIN>` checks Indian IDs; `node shared/rules.mjs` lists the rule files.

## Trust, but verify
Tax rates and codes change. Rule files in [`rules/`](rules/) carry the official link for every value and the
date range someone checked them for, and tools refuse dates outside that range. The skills tell your agent
to confirm against the official page before saving. None of this is tax advice; ask a chartered accountant
when it matters.

## License
MIT. See [LICENSE](LICENSE). Bundled: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
