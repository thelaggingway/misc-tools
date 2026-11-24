# misc-tools

Small standalone tools for Indian freelancers and small businesses. Each tool is a folder with:

- `index.html`: the human interface. Open it in a browser; no build step, no server, no install.
- `cli.mjs`: the agent interface. Takes JSON, writes the output file (e.g. a PDF). Node 18+, no npm install.
- `README.md`: usage and the JSON fields.

Both use the same template, so a PDF from the CLI looks exactly like one from the browser.

| Tool | What it makes |
|---|---|
| [invoice-generator](invoice-generator/) | A4 invoice PDF with GST options and amount in words (lakh/crore) |

## Personal data lives elsewhere
This repo is public and holds only tools, templates and made-up examples. Real profiles (addresses, bank
details, clients), per-document JSON and generated PDFs live in the private companion repo
[thelaggingway/misc-tools-private](https://github.com/thelaggingway/misc-tools-private) (owner access only).
Clone both side by side and run tools from the private repo, e.g.
`node ../misc-tools/invoice-generator/cli.mjs profiles/<profile>.json invoices/<client>/<no>.json -o ...`.
