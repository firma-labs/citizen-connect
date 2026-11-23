#!/usr/bin/env node
// Translation tools for the ICU MessageFormat files in messages/<lang>.json.
//
//   node scripts/i18n.mjs check             every language has exactly the English keys,
//                                           valid ICU syntax and the same {placeholders}
//   node scripts/i18n.mjs export [file]     side-by-side sheet for reviewers
//                                           (default translations/review.csv; opens in Excel)
//   node scripts/i18n.mjs export --build    the same, run before every build; keeps an existing
//                                           sheet that has edits or notes not yet imported
//   node scripts/i18n.mjs import <file>     apply a reviewed sheet back to messages/*.json
//
// English (en.json) is the source language; its key order and nesting are kept.

import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Papa from "papaparse";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const DIR = join(ROOT, "messages");
const SOURCE = "en";
const LOCALES = ["en", "mr", "hi"];
const NAMES = { en: "English", mr: "Marathi", hi: "Hindi" };

const read = (l) => JSON.parse(readFileSync(join(DIR, `${l}.json`), "utf8"));
const write = (l, data) => writeFileSync(join(DIR, `${l}.json`), JSON.stringify(data, null, 2) + "\n");

/** { a: { b: "x" } } → { "a.b": "x" } */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Nest flat keys in the given key order. */
function unflatten(flat, order) {
  const out = {};
  for (const key of order) {
    const parts = key.split(".");
    let o = out;
    for (const p of parts.slice(0, -1)) o = o[p] ??= {};
    o[parts.at(-1)] = flat[key];
  }
  return out;
}

/** Argument names used by an ICU message, including inside plural/select branches. */
function args(ast, out = new Set()) {
  for (const el of ast) {
    if ([TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural].includes(el.type)) out.add(el.value);
    if (el.type === TYPE.select || el.type === TYPE.plural) for (const o of Object.values(el.options)) args(o.value, out);
    if (el.type === TYPE.tag) args(el.children, out);
  }
  return out;
}

function check() {
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(read(l))]));
  const keys = Object.keys(flat[SOURCE]);
  const errors = [];
  const argsOf = {};
  for (const l of LOCALES) {
    for (const key of keys) {
      const text = flat[l][key];
      if (typeof text !== "string" || !text.trim()) {
        errors.push(`${l}: "${key}" is missing or empty`);
        continue;
      }
      try {
        const names = [...args(parse(text))].sort().join(", ");
        if (l === SOURCE) argsOf[key] = names;
        else if (names !== argsOf[key]) errors.push(`${l}: "${key}" uses {${names}} but English uses {${argsOf[key]}}`);
      } catch (e) {
        errors.push(`${l}: "${key}" is not valid ICU MessageFormat (${e.message})`);
      }
    }
    for (const key of Object.keys(flat[l])) if (!(key in flat[SOURCE])) errors.push(`${l}: "${key}" is not in en.json`);
  }
  if (errors.length) {
    console.error(`Translation check failed (${errors.length}):\n  ` + errors.join("\n  "));
    process.exit(1);
  }
  console.log(`Translations OK: ${keys.length} messages × ${LOCALES.length} languages (${LOCALES.join(", ")}).`);
}

const DEFAULT_SHEET = join(ROOT, "translations", "review.csv");
const BOM = "\uFEFF"; // so Excel opens the file as UTF-8 (Devanagari)
const column = (l) => `${l} (${NAMES[l]})`;

function readSheet(file) {
  const { data, errors } = Papa.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
  if (errors.length) throw new Error(`CSV: ${errors[0].message} (row ${errors[0].row})`);
  return data;
}

/** Snapshot of what was exported, kept next to the sheet: tells reviewer edits apart from later changes in the code. */
const baselineOf = (file) => file.replace(/\.csv$/, "") + ".exported.json";

/** Rows a reviewer changed (versus what was exported) or left a note on. */
function pendingEdits(file) {
  try {
    const base = existsSync(baselineOf(file)) ? JSON.parse(readFileSync(baselineOf(file), "utf8")) : null;
    if (!base) return 0; // sheet from before snapshots existed: treat as unedited
    return readSheet(file).filter(
      (row) => row["reviewer notes"]?.trim() || LOCALES.some((l) => (row[column(l)] ?? "").trim() !== (base[l]?.[row.key] ?? "").trim()),
    ).length;
  } catch {
    return 1; // unreadable — don't overwrite it either
  }
}

function exportSheet(file = DEFAULT_SHEET, { build = false } = {}) {
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(read(l))]));
  if (build && existsSync(file)) {
    const pending = pendingEdits(file);
    if (pending) {
      console.warn(
        `Kept ${file}: ${pending} row(s) have reviewer edits or notes not yet imported. Run npm run i18n:import -- ${file} (rows with only notes stay until the file is moved or deleted).`,
      );
      return;
    }
  }
  const rows = Object.keys(flat[SOURCE]).map((key) => ({
    key,
    ...Object.fromEntries(LOCALES.map((l) => [column(l), flat[l][key] ?? ""])),
    "reviewer notes": "",
  }));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, BOM + Papa.unparse(rows, { quotes: true, newline: "\r\n" }));
  writeFileSync(baselineOf(file), JSON.stringify(flat));
  console.log(`Wrote ${rows.length} rows to ${file}. Reviewers edit the language columns (keep {placeholders} as they are) and add notes; then run: npm run i18n:import -- ${file}`);
}

function importSheet(file) {
  if (!file) throw new Error("usage: npm run i18n:import -- <file.csv>");
  const data = readSheet(file);
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(read(l))]));
  const order = Object.keys(flat[SOURCE]);
  let changed = 0;
  for (const row of data) {
    if (!(row.key in flat[SOURCE])) {
      console.warn(`skipped unknown key "${row.key}"`);
      continue;
    }
    for (const l of LOCALES) {
      const v = row[column(l)];
      if (typeof v === "string" && v.trim() && v !== flat[l][row.key]) {
        flat[l][row.key] = v.trim();
        changed++;
      }
    }
  }
  for (const l of LOCALES) write(l, unflatten(flat[l], order));
  // The sheet's edits are now in messages/: they no longer count as pending for the next build.
  writeFileSync(baselineOf(file), JSON.stringify(flat));
  console.log(`Applied ${changed} change(s) from ${file}.`);
  check();
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "check") check();
else if (cmd === "export" && arg === "--build") exportSheet(DEFAULT_SHEET, { build: true });
else if (cmd === "export") exportSheet(arg);
else if (cmd === "import") importSheet(arg);
else {
  console.error("usage: node scripts/i18n.mjs check | export [file] | import <file>");
  process.exit(2);
}
