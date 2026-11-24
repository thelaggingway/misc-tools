---
name: misc-tools-client-intake
description: Creates or updates a client file (or the owner's own profile) in the business workspace from a screenshot, visiting card, email signature, GST certificate or pasted text, checking GSTIN, PAN, IFSC and PIN code before saving. Use when the owner shares a client's address or details, or asks to add or change a client.
---

# Client intake

Work in the business workspace (the folder with `misc-tools.json`; `toolsPath` in it points to the tools).

## Steps
1. **Read the details** from the image or text: legal name, address, state, PIN code, GSTIN, PAN, email, phone.
   Read digits carefully; screenshots often confuse 0/O, 1/I, 5/S and 8/B.
2. **Check the IDs** offline:
   `node <toolsPath>/shared/check.mjs gstin <GSTIN> pin <PIN>` (also `pan`, `ifsc`, `upi`).
   A GSTIN with a wrong check character is almost always a misread; look at the image again before asking.
   The first two GSTIN digits are the state code and should match the address's state.
3. **Confirm what the format check cannot.** A valid format does not mean the GSTIN is active or the legal name
   matches. Ask the owner to confirm, or open https://services.gst.gov.in/services/searchtp yourself if you
   can, and compare the legal name and state. Say which you did.
4. **Write `clients/<short-name>.json`** using invoice field names (see `node <toolsPath>/invoice-generator/cli.mjs --schema`):
   ```json
   {
     "toName": "Example Technologies Pvt Ltd",
     "toAddress": "4th Floor, Tower B\nHitec City\nHyderabad\nTelangana 500081",
     "toGstin": "36AAACE1234F1Z7",
     "place": "Telangana"
   }
   ```
   `place` is the place of supply, normally the client's state. Use a short lowercase file name (`acme`).
   For the owner's own details use `profiles/me.json` with `fromName`, `fromAddress`, `fromTag`, bank fields
   and `upiId`.
5. **Validate the file** with `node <toolsPath>/invoice-generator/cli.mjs clients/<short-name>.json --check`.
6. Show the owner the saved details and anything you were unsure of. If the workspace is a git repository,
   commit the file.

Never guess a missing GSTIN, PIN code or state: leave the field out and ask.
