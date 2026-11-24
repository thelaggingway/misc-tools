# misc-tools

Small standalone tools for Indian freelancers and small businesses. Each tool is a folder with:

- `index.html`: the human interface. Open it in a browser; no build step, no server, no install.
- `cli.mjs`: the agent interface. Takes JSON, writes the output file (e.g. a PDF). Node 18+, no npm install.
- `README.md`: usage and the JSON fields.

Both use the same template, so a PDF from the CLI looks exactly like one from the browser.

| Tool | What it makes |
|---|---|
| [invoice-generator](invoice-generator/) | A4 invoice PDF with GST options and amount in words (lakh/crore) |

Keep personal details (addresses, bank accounts) in `private/` or `*.local.json`; both are gitignored.
