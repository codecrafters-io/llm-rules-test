#!/usr/bin/env bun
/**
 * Convert reports/lint.json -> reports/junit.xml with repo-relative file paths
 * and best-effort line numbers from suggested_fixes (quote/original).
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

function findLine(src, q) {
  if (!src || !q) return 1;
  const idx = src.indexOf(q);
  if (idx < 0) return 1;
  return Math.max(1, src.slice(0, idx).split(/\r?\n/).length);
}

function renderFixKV(fx) {
  if (fx == null) return ''; // skip empties
  if (typeof fx === 'string') {
    const t = fx.trim();
    return t ? `- fix: ${t}` : '';
  }
  if (typeof fx !== 'object') {
    return `- fix: ${String(fx)}`;
  }

  // Preferred ordering of keys if present
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

  // Flatten add_section_after_hook for readability
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

  // Build lines, skipping null/undefined/empty strings
  const seen = new Set();
  const entries = [];

  // ordered keys first
  for (const k of order) {
    if (Object.prototype.hasOwnProperty.call(flat, k)) {
      const v = flat[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        entries.push([k, v]);
        seen.add(k);
      }
    }
  }
  // any remaining keys
  for (const [k, v] of Object.entries(flat)) {
    if (seen.has(k)) continue;
    if (v === null || v === undefined || String(v).trim() === '') continue;
    entries.push([k, v]);
  }

  if (entries.length === 0) return '';

  // Format nicely; quote multi-word values
  const lines = entries.map(([k, v]) => {
    const val =
      typeof v === 'string'
        ? `"${v.replace(/\r?\n/g, '\\n')}"`
        : typeof v === 'object'
        ? `"${JSON.stringify(v)}"`
        : String(v);
    return `- ${k}: ${val}`;
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
          // Determine a useful line number if failed
          let line = 1;
          if (!r.pass && Array.isArray(r.suggested_fixes)) {
            for (const fx of r.suggested_fixes) {
              const q =
                (fx &&
                  typeof fx === 'object' &&
                  typeof fx.quote === 'string' &&
                  fx.quote) ||
                (fx &&
                  typeof fx === 'object' &&
                  typeof fx.original === 'string' &&
                  fx.original) ||
                '';
              if (q) {
                line = findLine(src, q);
                if (line > 1) break;
              }
            }
          }

          if (r.pass) {
            // PASS testcases have no <failure>
            return `<testcase name="${esc(r.id)}" classname="${esc(
              repoRel
            )}" file="${esc(repoRel)}" line="${line}"></testcase>`;
          } else {
            // Message = rationale ONLY (no duplication)
            const msg = r.rationale ? r.rationale : 'Failed rule';

            // Body: bullet key/value list for each fix (no "n/a"), and (once) the rationale label for clarity
            const fixes = Array.isArray(r.suggested_fixes)
              ? r.suggested_fixes.map(renderFixKV).filter(Boolean)
              : [];
            const bodyParts = [];
            if (r.rationale)
              bodyParts.push(
                `- rationale: "${r.rationale.replace(/\r?\n/g, '\\n')}"`
              );
            if (fixes.length) {
              bodyParts.push('- suggested fixes:');
              // indent fixes by two spaces
              bodyParts.push(fixes.map((l) => `  ${l}`).join('\n'));
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
