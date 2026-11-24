#!/usr/bin/env node
// Invoice PDF from JSON, using the same index.html template people use in the browser.
// Usage and fields: node invoice-generator/cli.mjs --help   (JSON Schema: --schema)
import { createRequire } from "node:module";
import { runCli } from "../shared/cli.mjs";
const { check } = createRequire(import.meta.url)("../shared/india.js");

runCli({
  tool: import.meta.url,
  dataVar: "INVOICE_DATA",
  check: d => d.upiQr && !d.upiId ? "upiQr: is true but upiId is missing"
    : d.toGstin ? (e => e && "toGstin: " + e)(check("gstin", d.toGstin)) : null,
  name: d => d.invNo || "invoice",
});
