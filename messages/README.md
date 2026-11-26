# Translations

All text shown by the app — screens, buttons, reference lists (venues,
categories, departments), the WhatsApp message and the token slip — lives here, one file per
language:

| File | Language | Status |
|---|---|---|
| `en.json` | English | **Source language.** Every other file has exactly these keys. |
| `mr.json` | Marathi | Default language at the Darbar. |
| `hi.json` | Hindi | Written for the pilot — needs review by a native speaker. |

File names are BCP 47 language codes. The text uses **ICU MessageFormat**, the
format read by next-intl / use-intl, FormatJS, Crowdin, Lokalise, Phrase and
Weblate, so the files can go straight into a translation tool.

## Writing rules

- **Keep `{placeholders}` exactly as they are**, e.g. `{n}`, `{token}`, `{date}`.
  Move them within the sentence as the language needs.
- **Plurals** use ICU plural form — translate the words in each branch, keep the
  structure and `#` (the number):
  `{n, plural, one {# page received} other {# pages received}}`
- Plain, short wording. Name the same action the same way everywhere (the
  button "Issue token" and the screen after it both say "token").
- `whatsapp.tokenReceived` must match the WhatsApp message template approved
  for the business number word for word — change both together.
- Keep the `✦` separators in `seal.ring` (the round stamp on the token slip).

## Review workflow (spreadsheet)

```bash
npm run i18n:export          # → translations/review.csv (opens in Excel / Google Sheets)
```

Every `npm run build` also refreshes `translations/review.csv`, so the latest
sheet is always there after a build (the folder is not committed). If that file
holds reviewer edits or notes that were not imported yet, the build keeps it
and prints a warning instead of overwriting it.

Reviewers correct the language columns and use **reviewer notes** for
questions. Then:

```bash
npm run i18n:import -- translations/review.csv   # writes the corrections into messages/*.json
```

## Checks

```bash
npm run i18n:check
```

Fails if a language is missing a key or has an extra one, if a message is not
valid ICU, or if its `{placeholders}` differ from English. It also runs before
every build, and the TypeScript build fails when a key used in code is missing
from `en.json`.

## Adding text

1. Add the key to `en.json`, then the same key to `mr.json` and `hi.json`.
2. Use it in code: `t("section.key")` in components (`useI18n()`), or
   `translate(locale, "section.key")` outside React (`src/lib/i18n/core.ts`).
3. Run `npm run i18n:check`.
