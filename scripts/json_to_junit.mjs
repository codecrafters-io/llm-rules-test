#!/usr/bin/env bun
/**
 * Convert reports/lint.json -> reports/junit.xml with repo-relative file paths
 * and best-effort line numbers from suggested_fixes (quote/original).
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

function normalizeFix(fx) {
  if (fx == null) return '';
  if (typeof fx === 'string') return fx.trim();

  // Prefer precise location/transform first
  if (fx.line != null || fx.before || fx.after || fx.heading) {
    const parts = [];
    if (fx.line != null) parts.push(`line ${fx.line}:`);
    if (fx.before && fx.after)
      return `${parts.join(' ')} "${fx.before}" → "${fx.after}"`.trim();
    if (fx.after && !fx.before)
      return `${parts.join(' ')} replace with "${fx.after}"`.trim();
    if (fx.before && !fx.after)
      return `${parts.join(' ')} replace "${
        fx.before
      }" (after: missing)`.trim();
    if (fx.heading)
      return `${parts.join(' ')} set heading to "${fx.heading}"`.trim();
    // fallthrough if nothing usable
  }

  // match/replace_with pair
  if (fx.match || fx.replace_with) {
    const m = fx.match ? `"${fx.match}"` : 'pattern';
    const r = fx.replace_with ? `"${fx.replace_with}"` : 'replacement';
    return `replace ${m} → ${r}`;
  }

  // original/suggestion[/explanation] — only show "original" if present
  if (fx.original || fx.suggestion || fx.explanation) {
    const lhs = fx.original ? `"${fx.original}"` : '';
    const rhs = fx.suggestion ? `"${fx.suggestion}"` : '';
    const e = fx.explanation ? ` — ${fx.explanation}` : '';
    if (lhs && rhs) return `change ${lhs} → ${rhs}${e}`;
    if (rhs) return `change to ${rhs}${e}`;
    if (lhs) return `change ${lhs}${e}`;
    // nothing meaningful
  }

  // action/target_location/current_text/replacement_text/reason
  if (
    fx.action ||
    fx.current_text ||
    fx.replacement_text ||
    fx.reason ||
    fx.target_location
  ) {
    const parts = [];
    if (fx.action) parts.push(`[${fx.action}]`);
    if (fx.target_location) parts.push(`at ${fx.target_location}`);
    if (fx.current_text || fx.replacement_text) {
      const cur = fx.current_text ? `"${fx.current_text}"` : 'n/a';
      const rep = fx.replacement_text ? `"${fx.replacement_text}"` : 'n/a';
      parts.push(`${cur} → ${rep}`);
    }
    if (fx.reason) parts.push(`(${fx.reason})`);
    return parts.join(' ').trim();
  }

  // add_section_after_hook
  if (fx.add_section_after_hook) {
    const h = fx.add_section_after_hook.heading || '(heading)';
    return `insert section after hook: ${h}`;
  }

  try {
    return JSON.stringify(fx);
  } catch {
    return String(fx);
  }
}

function main() {
  let data;
  try {
    data = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (e) {
    console.log('No lint.json found; skipping JUnit conversion.');
    process.exit(0);
  }

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
          const normalized = fixesArr
            .map(normalizeFix)
            .filter((s) => s && s.trim().length > 0);
          const topFix = normalized[0] || '';

          let line = 1;
          if (!r.pass) {
            for (const fx of fixesArr) {
              if (
                fx &&
                typeof fx === 'object' &&
                typeof fx.quote === 'string' &&
                fx.quote
              ) {
                line = findLine(src, fx.quote);
                break;
              }
              if (
                typeof fx === 'object' &&
                typeof fx.original === 'string' &&
                fx.original
              ) {
                line = findLine(src, fx.original);
                break;
              }
            }
          }

          if (r.pass) {
            return `<testcase name="${esc(r.id)}" classname="${esc(
              repoRel
            )}" file="${esc(repoRel)}" line="${line}"></testcase>`;
          } else {
            const msgBase = r.rationale ? r.rationale : 'Failed rule';
            const msg = topFix ? `${msgBase} — ${topFix}` : msgBase;

            const bodyLines = [];
            if (r.rationale) bodyLines.push(`rationale: ${r.rationale}`);
            if (normalized.length) {
              bodyLines.push('suggested fixes:');
              for (const s of normalized.slice(0, 20)) bodyLines.push(`- ${s}`);
              if (normalized.length > 20)
                bodyLines.push(`- +${normalized.length - 20} more`);
            }
            const body = esc(bodyLines.join('\n'));

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
