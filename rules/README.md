# rules/

Dated reference data that tools and agents rely on: GST rates, TDS sections, SAC/HSN codes, state codes,
and later customs and export data. Every value says where it came from and how long it is vouched for,
so an agent can open the official page and confirm it before saving a document.

These files are a convenience, not an authority. The official source always wins; if they disagree, the
file is wrong and needs updating.

## Format

One JSON file per topic, `rules/<name>.json`:

```json
{
  "name": "tds-sections",
  "description": "TDS rates and thresholds for payments to residents, Income-tax Act 2025",
  "coverage": { "from": "2026-04-01", "to": "2027-03-31" },
  "checked_on": "2026-11-24",
  "sources": [
    { "id": "act2025", "title": "Income-tax Act, 2025, section 393", "url": "https://www.incometaxindia.gov.in/...", "notes": "Table in sub-section (1)" }
  ],
  "entries": [
    { "section": "393(1) [old 194J]", "payment": "Fees for professional services", "rate": 10,
      "threshold": 50000, "threshold_basis": "per payee per financial year",
      "effective_from": "2026-04-01", "effective_to": null, "source": "act2025" }
  ]
}
```

- `coverage`: the dates someone has vouched for. Tools refuse to use the file for a date outside it, so a stale
  file fails loudly instead of printing an old rate. Usually one financial year; extend it only after re-checking.
- `checked_on`: the day someone last compared every entry with its sources.
- `sources`: official pages first (CBIC, CBDT/incometaxindia.gov.in, GST Council, DGFT, RBI, ICEGATE). A secondary
  source (a blog, a third-party dataset) may be listed only alongside an official one, with `"secondary": true`.
- `entries`: any fields the topic needs, plus `source` (one of the source ids) and optional
  `effective_from` / `effective_to` when a value changed during the coverage period.

`node shared/rules.mjs` checks every file. In code, `loadRules(name, date)` from `shared/rules.mjs` returns the
entries in force on that date and throws when the date is not covered.

## Updating a file
Open each source, compare every entry, fix what changed (keep the old value with an `effective_to` if documents
dated before the change still need it), then set `checked_on` and extend `coverage`. Note what changed in the
commit message.
