# Working in misc-tools

- Use a tool through its CLI, not by driving the HTML form: `node <tool>/cli.mjs --help` prints its README,
  which lists every JSON field. Write the JSON, run the CLI, check it exits 0, then inspect the output file.
- The user's real details live in `private/*.json` (gitignored). Pass that file first and a small JSON with
  only the changes second; never commit personal data to this public repo.
- A new tool follows the same shape: one self-contained `index.html` that reads `window.<TOOL>_DATA` when
  present, a dependency-free `cli.mjs` that injects that data and prints with headless Chrome, and a README
  with a field table. Validate input in the CLI and reject unknown fields with a message that names them.
- After changing a template, render it both ways (browser screenshot and CLI PDF) and look at the result.
