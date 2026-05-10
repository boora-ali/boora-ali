#!/usr/bin/env node
/**
 * Converts Django GNU gettext .po files to i18next-compatible JSON.
 * Usage: node scripts/po-to-i18n.cjs
 *
 * Reads:  backend/locale/<lang>/LC_MESSAGES/django.po
 * Writes: frontend/public/locales/<lang>/django.json
 *
 * The frontend src/locales/<lang>/translation.json files remain the
 * authoritative source for UI strings. This script exports backend
 * model/validation strings so the frontend can display them in the
 * correct language if needed.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKEND_LOCALE = path.join(ROOT, "backend", "locale");
const FRONTEND_LOCALE = path.join(ROOT, "frontend", "public", "locales");

function parsePo(content) {
  const result = {};
  const entries = content.split(/\n\n+/);

  for (const entry of entries) {
    const msgid = entry.match(/^msgid\s+"((?:[^"\\]|\\.)*)"/m);
    const msgstr = entry.match(/^msgstr\s+"((?:[^"\\]|\\.)*)"/m);
    if (msgid && msgstr && msgid[1] && msgstr[1]) {
      result[msgid[1]] = msgstr[1];
    }
  }
  return result;
}

if (!fs.existsSync(BACKEND_LOCALE)) {
  console.log("No backend/locale directory found. Skipping.");
  process.exit(0);
}

const langs = fs.readdirSync(BACKEND_LOCALE);

for (const lang of langs) {
  const poPath = path.join(BACKEND_LOCALE, lang, "LC_MESSAGES", "django.po");
  if (!fs.existsSync(poPath)) continue;

  const content = fs.readFileSync(poPath, "utf8");
  const translations = parsePo(content);

  // Map Django locale codes to BCP 47 (pt_BR → pt-BR)
  const bcp47 = lang.replace("_", "-");
  const outDir = path.join(FRONTEND_LOCALE, bcp47);
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "django.json");
  fs.writeFileSync(outPath, JSON.stringify(translations, null, 2));
  console.log(`✓ ${lang} → ${outPath} (${Object.keys(translations).length} strings)`);
}
