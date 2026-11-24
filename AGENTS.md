# Working in misc-tools

- Use a tool through its CLI, not by driving the HTML form: `node <tool>/cli.mjs --help` prints its README,
  which lists every JSON field. Write the JSON, run the CLI, check it exits 0, then inspect the output file.
- This repo is public. The user's real details and outputs live in the private companion repo
  [thelaggingway/misc-tools-private](https://github.com/thelaggingway/misc-tools-private): profiles in
  `profiles/`, per-document JSON and PDFs in `invoices/<client>/`. Clone it next to this one
  (`misc-tools/` and `misc-tools-private/`), follow its `AGENTS.md`, and save every personal input and output
  there. Pass the profile first and a small JSON with only the changes second.
- Never commit personal data here: no real names, addresses, bank details or client documents. Examples in
  `*/examples/` must stay made up. `private/`, `*.local.json` and `*.pdf` are gitignored as a backstop.
- A new tool follows the same shape: one self-contained `index.html` that reads `window.<TOOL>_DATA` when
  present, a dependency-free `cli.mjs` that injects that data and prints with headless Chrome, and a README
  with a field table. Validate input in the CLI and reject unknown fields with a message that names them.
- After changing a template, render it both ways (browser screenshot and CLI PDF) and look at the result.
