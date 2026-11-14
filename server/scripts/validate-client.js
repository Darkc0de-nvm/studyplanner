'use strict';

/**
 * Offline validator for the static client.
 *
 * The project deliberately ships plain HTML/CSS/JS without a build step, so
 * CI needs a fast structural check that does not depend on an external W3C
 * service. The validator catches the mistakes that break the single-origin
 * Express setup or the CSP: missing document metadata, duplicate ids,
 * dangling local references, inline event handlers and non-deferred scripts.
 */

const fs = require('node:fs');
const path = require('node:path');

const CLIENT_DIR = path.resolve(__dirname, '..', '..', 'client');
const problems = [];
const warnings = [];

function fail(file, message) {
  problems.push(`${path.relative(CLIENT_DIR, file)}: ${message}`);
}

function warn(file, message) {
  warnings.push(`${path.relative(CLIENT_DIR, file)}: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function isExternal(url) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(url);
}

/**
 * Resolves a local URL from an HTML/CSS file and reports whether it exists.
 * Query strings and fragments are ignored; directory links fall back to
 * index.html and extensionless links fall back to `<name>.html`.
 */
function localTarget(fromFile, url) {
  const clean = url.split(/[?#]/)[0];
  if (!clean) return null;
  const base = clean.startsWith('/')
    ? path.join(CLIENT_DIR, clean)
    : path.resolve(path.dirname(fromFile), clean);
  const candidates = [base];
  if (!path.extname(base)) {
    candidates.push(`${base}.html`, path.join(base, 'index.html'));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) ? null : base;
}

function validateHtml(file) {
  const html = read(file);
  const ids = new Map();

  if (!/^<!DOCTYPE html>/i.test(html.trimStart())) fail(file, 'missing <!DOCTYPE html>');
  if (!/<html\b[^>]*\blang="uk"/i.test(html)) fail(file, 'missing lang="uk" on <html>');
  if (!/<meta\b[^>]*charset="utf-8"/i.test(html)) fail(file, 'missing <meta charset="utf-8">');
  if (!/<meta\b[^>]*name="viewport"/i.test(html)) fail(file, 'missing viewport meta tag');
  if (!/<meta\b[^>]*name="description"[^>]*content="[^"]+"/i.test(html)) {
    fail(file, 'missing non-empty meta description');
  }

  const title = html.match(/<title>([^<]*)<\/title>/i);
  if (!title || !title[1].trim()) fail(file, 'missing or empty <title>');

  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    const id = match[1];
    if (ids.has(id)) fail(file, `duplicate id "${id}"`);
    ids.set(id, true);
  }

  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith('#')) {
      if (url.length > 1 && !ids.has(url.slice(1))) fail(file, `dangling anchor "${url}"`);
      continue;
    }
    if (isExternal(url)) continue;
    const missing = localTarget(file, url);
    if (missing) fail(file, `missing local target "${url}"`);
  }

  for (const match of html.matchAll(/\bsrc="([^"]+)"/g)) {
    if (isExternal(match[1])) continue;
    const missing = localTarget(file, match[1]);
    if (missing) fail(file, `missing local script "${match[1]}"`);
  }

  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attributes = match[1];
    if (/\bsrc="/i.test(attributes) && !/\bdefer\b/i.test(attributes)) {
      fail(file, 'external script must use defer');
    }
    if (!/\bsrc="/i.test(attributes) && attributes.trim()) {
      warn(file, 'inline script found; CSP allows it only through a nonce/hash');
    }
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt="/i.test(match[1])) fail(file, '<img> without alt attribute');
  }

  for (const match of html.matchAll(/\son[a-z]+="/gi)) {
    fail(file, `inline event handler "${match[0].trim()}" blocked by CSP`);
  }
}

function validateCss(file) {
  const css = read(file);
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  const opens = (stripped.match(/{/g) || []).length;
  const closes = (stripped.match(/}/g) || []).length;
  if (opens !== closes) fail(file, `unbalanced braces: ${opens} "{" vs ${closes} "}"`);

  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const url = match[2].trim();
    if (isExternal(url)) continue;
    const missing = localTarget(file, url);
    if (missing) fail(file, `missing asset "${url}"`);
  }
}

function collect(directory, extension) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(fullPath, extension);
    return entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

for (const file of collect(CLIENT_DIR, '.html')) validateHtml(file);
for (const file of collect(CLIENT_DIR, '.css')) validateCss(file);

if (warnings.length > 0) {
  console.log(`Client validator warnings (${warnings.length}):`);
  for (const message of warnings) console.log(`  - ${message}`);
}

if (problems.length > 0) {
  console.error(`Client validator failed (${problems.length}):`);
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`Client validator passed: ${collect(CLIENT_DIR, '.html').length} HTML and ${collect(CLIENT_DIR, '.css').length} CSS files checked.`);
