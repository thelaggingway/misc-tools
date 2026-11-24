---
name: misc-tools-codes
description: Finds the SAC (services) or HSN (goods) code and the GST rate for what the owner sells, from the toolkit's dated rule files, then confirms it on the official CBIC notification before it goes on an invoice. Use when the owner or another skill needs a SAC/HSN code or a GST rate, or asks what GST applies to a service or product.
---

# SAC/HSN codes and GST rates

Work in the business workspace (the folder with `misc-tools.json`). The tools are at `<toolsPath>`.

## Steps
1. **Look it up.** `node <toolsPath>/shared/lookup.mjs sac consulting`, `... sac 998313`, `... hsn 0902`,
   `... hsn tea`. Words work in English or Hinglish (`kiraya`, `silai`, `hisaab`). A code also matches every
   code under it, so `sac 9983` lists the professional and IT services.
2. **Read the matches.** Several can print, and they can carry different rates (knitted apparel is 5% up to
   ₹2,500 a piece and 18% above). Choose the entry that describes what is actually being sold, not the one
   with the nearest words.
3. **Confirm on the official page** the match prints under *Confirm*. Open it and find the entry (search the
   PDF for the code or the heading, such as `9983`). Check three things against the owner's case:
   - the description covers what is being sold;
   - the rate applies on the document date (an entry can be replaced, as local delivery services were on
     1 November 2026);
   - any condition attached to it (input tax credit, a value threshold, "pre-packaged and labelled").
   If the page will not open, say so and do not use the rate.
4. **Tell the owner what you checked**: the code, the rate, the notification and its date, and anything you
   had to read the condition for. One or two lines is enough.
5. **On a document**, put the code in the item's `sac` field and set the document's `taxRate` to the rate you
   confirmed (see the misc-tools-invoices skill). This skill does not decide CGST+SGST versus IGST; that is
   place of supply.

## What this does not answer
- Whether a supply is exempt (Notification 12/2017-Central Tax (Rate)), who pays under reverse charge
  (13/2017), composition scheme, exports and LUT, or e-invoicing thresholds. Those are separate
  notifications; read them or ask the owner's accountant.
- Whether the owner must be registered at all.
- Rates printed are total GST. The notifications state central tax, so 9 means 18% GST and 2.5 means 5%.

## When the lookup is wrong or silent
`rules/sac-codes.json` and `rules/hsn-common.json` are a convenience, not an authority, and they are small on
purpose. If nothing matches, or the notification disagrees with the file, use what the notification says, tell
the owner, and say that the rule file needs updating — do not add a code or rate to it from memory.

## Never
- Fill a code or rate from memory, a blog, or another site's list.
- Use a "nearest" code when the service has its own entry (print-media advertising space is 5%, the agency
  work that sells it is 18%).
- Quote a rate whose dates do not cover the document date.
