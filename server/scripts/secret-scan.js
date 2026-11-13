'use strict';

/**
 * Lightweight secret scan for the working tree and the available git history.
 * Intentionally dependency-free so it can run in CI and on a clean checkout.
 * It is not a replacement for gitleaks; it catches common credential shapes.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.pdf', '.mp4', '.webm', '.map',
]);
const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

// Values used only by tests, examples and local placeholders.
const ALLOWED_GENERIC_VALUES = /test|example|e2e|dummy|fake|placeholder|change[_-]?me|your[_-]|sample|wrong|invalid/i;

const PATTERNS = [
  {
    name: 'private key block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  },
  {
    name: 'AWS access key id',
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub token',
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  },
  {
    name: 'Google API key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: 'Slack token',
    re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  },
  {
    name: 'Stripe live key',
    re: /\bsk_live_[0-9A-Za-z]{16,}\b/,
  },
  {
    name: 'database URL with credentials',
    re: /\bpostgres(?:ql)?:\/\/[^\s:@'"]+:(?!postgres\b)[^\s@'"]{4,}@/i,
  },
  {
    name: 'hard-coded secret assignment',
    re: /(?:^|[^A-Za-z0-9_])(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"]([^'"]{12,})['"]/i,
    allow(value) {
      return ALLOWED_GENERIC_VALUES.test(value);
    },
  },
];

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function scanText(text, location, findings) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(line);
      if (!match) continue;
      if (pattern.allow && pattern.allow(match[1] || '', line)) continue;
      findings.push(`${location}:${index + 1} — ${pattern.name}`);
    }
  });
}

function scanWorkingTree(findings) {
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
  for (const file of files) {
    if (SKIP_FILES.has(path.basename(file))) continue;
    if (SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (/(^|\/)\.env$/.test(file)) {
      findings.push(`${file}: tracked .env file`);
      continue;
    }

    const absolute = path.join(ROOT, file);
    const stat = fs.statSync(absolute, { throwIfNoEntry: false });
    if (!stat || stat.size > MAX_FILE_BYTES) continue;

    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue; // binary
    scanText(buffer.toString('utf8'), file, findings);
  }
}

function scanHistory(findings, limit = 5000) {
  let diff;
  try {
    diff = git(['log', '--all', '--no-color', '--no-ext-diff', '--unified=0', '-p']);
  } catch {
    return; // shallow checkout or no history
  }

  let commit = 'unknown';
  let file = 'unknown';
  let skipFile = false;
  for (const raw of diff.split(/\r?\n/)) {
    const commitMatch = /^commit ([0-9a-f]{7,40})/.exec(raw);
    if (commitMatch) {
      commit = commitMatch[1].slice(0, 12);
      continue;
    }
    const fileMatch = /^\+\+\+ b\/(.+)$/.exec(raw);
    if (fileMatch) {
      file = fileMatch[1];
      skipFile = SKIP_FILES.has(path.basename(file))
        || SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())
        || /(^|\/)\.env$/.test(file);
      continue;
    }
    if (skipFile) continue;
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    const content = raw.slice(1);
    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(content);
      if (!match) continue;
      if (pattern.allow && pattern.allow(match[1] || '', content)) continue;
      findings.push(`history ${commit} ${file} — ${pattern.name}`);
      if (findings.length >= limit) return;
    }
  }
}

function main() {
  const findings = [];
  scanWorkingTree(findings);
  scanHistory(findings);

  if (findings.length === 0) {
    console.log('Secret scan: PASS (no credential-shaped strings found).');
    return;
  }

  console.error(`Secret scan: FAIL (${findings.length} finding(s)).`);
  for (const finding of findings.slice(0, 50)) console.error(` - ${finding}`);
  process.exitCode = 1;
}

main();
