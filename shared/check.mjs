#!/usr/bin/env node
// Check Indian IDs offline: node shared/check.mjs gstin 27AAPFU0939F1ZV pan AAPFU0939F ifsc ICIC0001190
// Kinds: gstin, pan, ifsc, pin, upi. Prints one line per ID; exits 1 if any is invalid.
// This checks format (and the GSTIN check digit) only. Whether a GSTIN is active, or an IFSC exists,
// must be confirmed on the official sites printed below.
import { createRequire } from "node:module";
const { check } = createRequire(import.meta.url)("./india.js");

const VERIFY = {
  gstin: "https://services.gst.gov.in/services/searchtp",
  pan: "https://eportal.incometax.gov.in/iec/foservices/#/pre-login/verifyYourPAN",
  ifsc: "https://www.rbi.org.in/Scripts/IFSCMICRDetails.aspx",
  pin: "https://www.indiapost.gov.in (search \"Pincode\")",
};
const args = process.argv.slice(2);
if (!args.length || args.length % 2) {
  console.log("usage: node shared/check.mjs <gstin|pan|ifsc|pin|upi> <value> [<kind> <value> ...]"); process.exit(args.length ? 1 : 0);
}
let bad = false;
for (let i = 0; i < args.length; i += 2) {
  const [kind, value] = [args[i].toLowerCase(), args[i + 1]];
  const err = check(kind, value);
  if (err) bad = true;
  console.log(`${kind} ${value}: ${err ? "INVALID - " + err : "format ok"}${!err && VERIFY[kind] ? "; confirm at " + VERIFY[kind] : ""}`);
}
process.exit(bad ? 1 : 0);
