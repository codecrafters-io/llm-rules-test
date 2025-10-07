#!/usr/bin/env bun
/**
 * Convert reports/lint.json -> reports/junit.xml
 * - Repo-relative file paths for inline annotations
 * - Best-effort line numbers from fixes: line > before > quote > original
 * - Clean body as bullet key/value pairs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = (process.env.REPO_ROOT || '').replace(/\\/g, '/');
const reportPath = resolve('reports/lint.json');
const outPath = resolve('reports/junit.xml');

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toRepoRel = (p) => {
  p = String(p).replace(/\\/g, '/');
  if (REPO_ROOT && p.startsWith(REPO_ROOT + '/'))
    p = p.slice(REPO_ROOT.length + 1);
  if (p.startsWith('./')) p = p.slice(2);
  return p;
};

const collapseWS = (s) => s.replace(/\s+/g, ' ').trim();

function findLineSmart(src, needle) {
  if (!src || !needle) return 1;

  // 0) Exact index
  let idx = src.indexOf(needle);
  if (idx >= 0) return src.slice(0, idx).split(/\r?\n/).length || 1;

  // 1) Per-line, case-sensitive "contains"
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }

  // 2) Per-line, case-insensitive "contains"
  const nlc = needle.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(nlc)) return i + 1;
  }

  // 3) Whitespace-collapsed contains (case-insensitive)
  const srcCollapsed = collapseWS(src.toLowerCase());
  const needleCollapsed = collapseWS(needle.toLowerCase());
  idx = srcCollapsed.indexOf(needleCollapsed);
  if (idx >= 0) {
    // Map back approximately by counting original newlines up to a rough segment
    // As exact mapping is expensive, do a best-effort: scan original lines until cumulative length exceeds idx
    let acc = 0;
    const origLines = src.split(/\r?\n/);
    for (let i = 0; i < origLines.length; i++) {
      acc += collapseWS(origLines[i].toLowerCase()).length + 1; // +1 ~ space/newline
      if (acc >= idx) return i + 1;
    }
  }

  return 1;
}

function deriveLine(src, fixesArr) {
  if (!Array.isArray(fixesArr) || fixesArr.length === 0) return 1;

  // 1) If any fix explicitly has a numeric "line", trust it
  for (const fx of fixesArr) {
    if (
      fx &&
      typeof fx === 'object' &&
      Number.isFinite(fx.line) &&
      fx.line > 0
    ) {
      return Math.floor(fx.line);
    }
  }

  // 2) Prefer "before" (e.g., heading replacements), then "quote", then "original"
  for (const key of ['before', 'quote', 'original']) {
    for (const fx of fixesArr) {
      if (
        fx &&
        typeof fx === 'object' &&
        typeof fx[key] === 'string' &&
        fx[key].trim()
      ) {
        const ln = findLineSmart(src, fx[key]);
        if (ln > 1) return ln;
      }
    }
  }

  return 1;
}

/** Render a fix as bullet key/value pairs (skip empties, no "n/a") */
function renderFixKV(fx) {
  if (fx == null) return '';
  if (typeof fx === 'string') {
    const t = fx.trim();
    return t ? `  - fix: "${t.replace(/\r?\n/g, '\\n')}"` : '';
  }
  if (typeof fx !== 'object') return `  - fix: "${String(fx)}"`;

  const order = [
    'line',
    'before',
    'after',
    'match',
    'replace_with',
    'original',
    'suggestion',
    'explanation',
    'quote',
    'action',
    'target_location',
    'current_text',
    'replacement_text',
    'reason',
    'heading',
    'description',
    'proposed_hook',
    'add_section_after_hook',
  ];

  const flat = { ...fx };
  if (
    flat.add_section_after_hook &&
    typeof flat.add_section_after_hook === 'object'
  ) {
    const h = flat.add_section_after_hook.heading;
    const b = flat.add_section_after_hook.body;
    if (h) flat['add_section_after_hook.heading'] = h;
    if (b) flat['add_section_after_hook.body'] = b;
    delete flat.add_section_after_hook;
  }

  const seen = new Set();
  const entries = [];

  for (const k of order) {
    if (Object.prototype.hasOwnProperty.call(flat, k)) {
      const v = flat[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        entries.push([k, v]);
        seen.add(k);
      }
    }
  }
  for (const [k, v] of Object.entries(flat)) {
    if (seen.has(k)) continue;
    if (v === null || v === undefined || String(v).trim() === '') continue;
    entries.push([k, v]);
  }

  if (entries.length === 0) return '';

  const lines = entries.map(([k, v]) => {
    const val =
      typeof v === 'string'
        ? `"${v.replace(/\r?\n/g, '\\n')}"`
        : typeof v === 'object'
        ? `"${JSON.stringify(v)}"`
        : String(v);
    return `  - ${k}: ${val}`;
  });

  return lines.join('\n');
}

function main() {
  if (!existsSync(reportPath)) {
    console.log('No lint.json found; skipping JUnit conversion.');
    return;
  }

  const data = JSON.parse(readFileSync(reportPath, 'utf8'));

  const testCount = data.files.reduce((a, f) => a + f.rules.length, 0);
  const failCount = data.files.reduce(
    (a, f) => a + f.rules.filter((r) => !r.pass).length,
    0
  );

  const suites = data.files
    .map((f) => {
      const repoRel = toRepoRel(f.file);
      const src = f.source || '';
      const tests = f.rules.length;
      const failures = f.rules.filter((r) => !r.pass).length;

      const cases = f.rules
        .map((r) => {
          const fixesArr = Array.isArray(r.suggested_fixes)
            ? r.suggested_fixes
            : [];
          const line = r.pass ? 1 : deriveLine(src, fixesArr);

          if (r.pass) {
            return `<testcase name="${esc(r.id)}" classname="${esc(
              repoRel
            )}" file="${esc(repoRel)}" line="${line}"></testcase>`;
          } else {
            const msg = r.rationale ? r.rationale : 'Failed rule';
            const fixes = fixesArr.map(renderFixKV).filter(Boolean);
            const bodyParts = [];
            if (fixes.length) {
              bodyParts.push('\nSuggested fixes:');
              bodyParts.push(fixes.join('\n')); // already indented
            }
            const body = esc(bodyParts.join('\n'));

            return `<testcase name="${esc(r.id)}" classname="${esc(
              repoRel
            )}" file="${esc(repoRel)}" line="${line}">
  <failure message="${esc(msg)}">${body}</failure>
</testcase>`;
          }
        })
        .join('\n');

      return `<testsuite name="${esc(
        repoRel
      )}" tests="${tests}" failures="${failures}">
${cases}
</testsuite>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="llm-doc-linter" tests="${testCount}" failures="${failCount}">
${suites}
</testsuites>
`;
  writeFileSync(outPath, xml, 'utf8');
  console.log('Wrote JUnit to reports/junit.xml');
}

main();
