# Developing misc-tools

This file is for agents changing the tools. To *use* the tools for someone's business, work in their
workspace (made by `setup.mjs`) and follow the skills there, not this file.

## Shape of a tool
Each tool is a folder with:
- `index.html`: the form and A4 template people use in a browser. It loads `../shared/india.js` (and other
  `../shared/*.js` files) with plain `<script src>` tags and reads `window.<TOOL>_DATA` when the CLI injects it.
  No build step, no npm packages, works from `file://`.
- `schema.json`: JSON Schema for the input, with `additionalProperties: false` and a `description` on every
  field. Agents read it with `cli.mjs --schema`.
- `cli.mjs`: a few lines calling `runCli` from `shared/cli.mjs` (merges JSON files, validates against the schema,
  renders the page in headless Chrome, writes the PDF). Cross-field rules go in its `check`.
- `README.md`: what it makes, the fields, examples. `cli.mjs --help` prints it.
- `examples/`: made-up inputs only.
- A skill in `skills/misc-tools-<tool>/SKILL.md`: when to use the tool and the exact steps, written for an agent
  working in a user's workspace (paths relative to the workspace, the tool at `<toolsPath>` from
  `misc-tools.json`). Tell it what to verify on which official page before saving.

Shared code lives in `shared/`: `india.js` (rupee formatting, dates, amount in words, GSTIN/PAN/IFSC/PIN/UPI
checks), `cli.mjs`, `rules.mjs` (dated rule files, see `rules/README.md`), `check.mjs`. Use these instead of
copying helpers into a tool. Tax rates, codes and thresholds go in `rules/` with official sources, never as
constants in a tool.

## Rules
- This repo is public. No real names, addresses, GSTINs, bank details or client documents, including in
  examples and tests. The owner's own data lives in their workspace (for the maintainer:
  [thelaggingway/misc-tools-private](https://github.com/thelaggingway/misc-tools-private)).
- Every tax fact in code, rules or skills cites an official source (CBIC, CBDT/incometaxindia.gov.in, GST Council,
  DGFT, RBI, ICEGATE, labour.gov.in). If you could not open the source, say so in the commit and the file.
- Do not copy code or data from GPL/AGPL projects or from repos without a license. MIT, Apache-2.0, BSD and
  CC-BY data are fine with attribution in the README.
- After changing a template, render it both ways (browser screenshot and CLI PDF) and look at the result.
  Changes to shared code must leave existing tools' output unchanged unless that is the point; compare renders
  of the examples before and after.
- After adding or renaming a skill, run `node setup.mjs <scratch-folder>` and check the skill lands in both
  `.agents/skills/` and `.claude/skills/`.
