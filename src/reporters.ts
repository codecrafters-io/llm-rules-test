// src/reporters.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PrettyReportOptions, RuleResult, Summary } from './types';

const niceDate = () =>
  new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const codeFenceSafe = (md: string) => {
  // prevent breaking fenced blocks if content contains ```
  return md.replace(/```/g, '``\\`');
};

/* ----------------------------- Markdown report ----------------------------- */

function slugify(id: string) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function renderMarkdownReport(
  summary: Summary,
  opts: PrettyReportOptions = {}
): string {
  const { model, checked, passed, failed, files } = summary;
  const showPassDetails = !!opts.showPassDetails;
  const includeSource = !!opts.includeSource;
  const expandSource = !!opts.expandSource;
  const safe = (s: any) => String(s).replace(/\r?\n/g, ' ');
  const badge = (ok: boolean) => (ok ? '✅' : '❌');

  // ---------- DASHBOARD (top summary table with links) ----------
  const dashboardHeader = [
    `# 📄 LLM Doc Linter Report`,
    ``,
    `**Generated:** ${niceDate()}`,
    ``,
    `| Model | Files | Passed | Failed |`,
    `| --- | ---: | ---: | ---: |`,
    `| \`${model}\` | ${checked} | ${passed} | ${failed} |`,
    ``,
    `## 📊 Summary`,
    `This table summarizes all stages. Click a **Stage** to jump to its details.`,
    ``,
    `| Stage | Status | Passed | Failed | Failed Rules |`,
    `|:------:|:------|------:|------:|:-------------|`,
  ].join('\n');

  const dashboardRows = files
    .map((f) => {
      const ok = f.overall_pass;
      const passCount = f.rules.filter((r) => r.pass).length;
      const failCount = f.rules.length - passCount;
      const fileId = `stage-${slugify(path.basename(f.file))}`;
      const failedRuleList =
        f.rules
          .filter((r) => !r.pass)
          .map((r) => `\`${r.id}\``)
          .join(', ') || '—';
      return `| [\`${path.basename(f.file)}\`](#${fileId}) | ${
        ok ? '✅' : '❌'
      } | ${passCount} | ${failCount} | ${failedRuleList} |`;
    })
    .join('\n');

  // ---------- DETAILED SECTIONS ----------
  const details = files
    .map((f) => {
      const ok = f.overall_pass;
      const passCount = f.rules.filter((r) => r.pass).length;
      const failCount = f.rules.length - passCount;
      const fileId = `stage-${slugify(path.basename(f.file))}`;

      const failedBlocks = f.rules
        .filter((r) => !r.pass)
        .flatMap((r) => {
          const lines = [
            `- **${r.id}**`,
            r.rationale ? `  - **rationale:** ${safe(r.rationale)}` : ``,
          ];
          if (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length) {
            lines.push(`  - **suggested fixes:**`);
            for (const fx of r.suggested_fixes.slice(0, 5)) {
              lines.push(
                `    - ${safe(
                  typeof fx === 'string' ? fx : JSON.stringify(fx)
                )}`
              );
            }
            if (r.suggested_fixes.length > 5) {
              lines.push(`    - _+${r.suggested_fixes.length - 5} more_`);
            }
          }
          lines.push('');
          return lines;
        })
        .join('\n');

      const passedBlocks = f.rules
        .filter((r) => r.pass)
        .flatMap((r) => {
          const lines = [`- ${badge(true)} **${r.id}**`];
          if (showPassDetails) {
            if (r.rationale) lines.push(`  - **note:** ${safe(r.rationale)}`);
            if (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length) {
              lines.push(`  - **notes:**`);
              for (const fx of r.suggested_fixes.slice(0, 3)) {
                lines.push(
                  `    - ${safe(
                    typeof fx === 'string' ? fx : JSON.stringify(fx)
                  )}`
                );
              }
            }
          }
          lines.push('');
          return lines;
        })
        .join('\n');

      const sourceBlock =
        includeSource && f.source
          ? [
              ``,
              `<details${expandSource ? ' open' : ''}>`,
              `<summary><strong>View source markdown</strong></summary>`,
              ``,
              '```markdown',
              codeFenceSafe(f.source),
              '```',
              ``,
              `</details>`,
            ].join('\n')
          : '';

      return [
        `\n---\n`,
        `### ${ok ? '✅' : '❌'} \`${path.basename(
          f.file
        )}\`  —  _${passCount} passed, ${failCount} failed_`,
        `<a id="${fileId}"></a>`,
        ``,
        sourceBlock,
        ``,
        failCount
          ? `**Failed rules**\n\n${failedBlocks}`
          : `_No failed rules for this file._`,
        ``,
        `**Passed rules**`,
        ``,
        passedBlocks || '_No passed rules._',
        ``,
        `[Back to summary](#📊-summary) • [Back to top](#📄-llm-doc-linter-report)`,
      ].join('\n');
    })
    .join('\n');

  const footer = [
    `\n---`,
    `${failed ? '❌ **Result: FAIL**' : '✅ **Result: PASS**'}`,
    '',
  ].join('\n');

  return [dashboardHeader, dashboardRows, details, footer].join('\n');
}

export function renderHtmlReport(
  summary: Summary,
  opts: PrettyReportOptions = {}
): string {
  const { failed, files } = summary;
  const showPassDetails = !!opts.showPassDetails;
  const includeSource = !!opts.includeSource;
  const expandSource = !!opts.expandSource;

  const esc = (s: any) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const resultBadge = failed
    ? `<span class="badge bad" aria-label="Overall result: FAIL" role="status">FAIL</span>`
    : `<span class="badge ok" aria-label="Overall result: PASS" role="status">PASS</span>`;

  const summaryRow = files
    .map((f, _) => {
      const passCount = f.rules.filter((r) => r.pass).length;
      const failCount = f.rules.length - passCount;
      const id = `stage-${slugify(path.basename(f.file))}`;
      const failedRules =
        f.rules
          .filter((r) => !r.pass)
          .map((r) => esc(r.id))
          .join(', ') || '—';
      const icon = f.overall_pass ? '🟢' : '🔴';
      return `
        <tr>
        <th scope="row"><a href="#${id}" class="stage-link">${esc(
        path.basename(f.file)
      )}</a></th>
        <td class="status" aria-label="${
          f.overall_pass ? 'Pass' : 'Fail'
        }">${icon}</td>
          <td class="num">${passCount}</td>
          <td class="num">${failCount}</td>
          <td class="failed-list">${failedRules}</td>
        </tr>`;
    })
    .join('\n');

  const fileSections = files
    .map((f) => {
      const passCount = f.rules.filter((r) => r.pass).length;
      const failCount = f.rules.length - passCount;
      const id = `stage-${slugify(path.basename(f.file))}`;

      const failedBlocks = f.rules
        .filter((r) => !r.pass)
        .map((r) => {
          const fixes =
            Array.isArray(r.suggested_fixes) && r.suggested_fixes.length
              ? `<div class="kv"><span>suggested fixes:</span><ul>${
                  r.suggested_fixes
                    .slice(0, 5)
                    .map(
                      (fx) =>
                        `<li>${esc(
                          typeof fx === 'string' ? fx : JSON.stringify(fx)
                        )}</li>`
                    )
                    .join('') +
                  (r.suggested_fixes.length > 5
                    ? `<li class="more">+${
                        r.suggested_fixes.length - 5
                      } more</li>`
                    : '')
                }</ul></div>`
              : '';
          return `
          <div class="rule fail" role="group" aria-labelledby="${id}-fail-${esc(
            r.id
          )}">
            <div class="rule-head">
              <span class="badge bad">FAIL</span>
              <strong id="${id}-fail-${esc(r.id)}">${esc(r.id)}</strong>
            </div>
            ${
              r.rationale
                ? `<div class="kv"><span>rationale:</span><p>${esc(
                    r.rationale
                  )}</p></div>`
                : ''
            }
            ${fixes}
          </div>`;
        })
        .join('');

      const passedBlocks = f.rules
        .filter((r) => r.pass)
        .map((r) => {
          if (!showPassDetails) {
            return `
              <div class="rule pass compact" role="group" aria-label="PASS ${esc(
                r.id
              )}">
                <div class="rule-head">
                  <span class="badge ok">PASS</span>
                  <strong>${esc(r.id)}</strong>
                </div>
              </div>`;
          }
          const notes =
            (r.rationale
              ? `<div class="kv"><span>note:</span><p>${esc(
                  r.rationale
                )}</p></div>`
              : '') +
            (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length
              ? `<div class="kv"><span>notes:</span><ul>${r.suggested_fixes
                  .slice(0, 3)
                  .map(
                    (fx) =>
                      `<li>${esc(
                        typeof fx === 'string' ? fx : JSON.stringify(fx)
                      )}</li>`
                  )
                  .join('')}</ul></div>`
              : '');
          return `
            <div class="rule pass" role="group" aria-label="PASS ${esc(r.id)}">
              <div class="rule-head">
                <span class="badge ok">PASS</span>
                <strong>${esc(r.id)}</strong>
              </div>
              ${notes}
            </div>`;
        })
        .join('');

      const sourceBlock =
        includeSource && f.source
          ? `
        <details class="source"${expandSource ? ' open' : ''}>
          <summary>View source markdown</summary>
          <div class="source-actions">
            <button class="copy-btn" data-target="${id}-src">Copy</button>
          </div>
          <pre><code id="${id}-src" class="lang-md">${esc(
              f.source
            )}</code></pre>
        </details>`
          : '';

      return `
        <section class="file ${
          f.overall_pass ? 'ok' : 'bad'
        }" id="${id}" aria-labelledby="${id}-title">
          <h2 id="${id}-title">${f.overall_pass ? '✅' : '❌'} ${esc(
        path.basename(f.file)
      )}
            <small>(${passCount} passed, ${failCount} failed)</small>
          </h2>

          ${sourceBlock}

          <div class="rules-group">
            <h3>Failed rules</h3>
            ${
              failedBlocks ||
              `<p class="muted">No failed rules for this file.</p>`
            }
          </div>

          <div class="rules-group">
            <h3>Passed rules</h3>
            ${passedBlocks || `<p class="muted">No passed rules.</p>`}
          </div>

          <p class="backlinks">
            <a href="#summary" class="back">Back to summary</a> ·
            <a href="#top" class="back">Back to top</a>
          </p>
        </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>LLM Doc Linter Report</title>
<style>
  :root{
    --bg:#0f1115; --panel:#171923; --ink:#e6e6e6; --muted:#9aa2b1;
    --ok:#22c55e; --bad:#ef4444; --hl:#60a5fa; --chip:#232739; --table:#0f1525;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
  a{color:var(--hl)}
  .wrap{max-width:1180px;margin:32px auto;padding:0 20px}
  header{margin-bottom:18px}
  h1{font-size:24px;margin:0 0 6px}
  .meta{color:var(--muted)}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}
  .chip{background:var(--chip);padding:4px 10px;border-radius:999px;color:var(--ink)}
  .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;font-size:12px;vertical-align:middle}
  .badge.ok{background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.35)}
  .badge.bad{background:rgba(239,68,68,.15);color:var(--bad);border:1px solid rgba(239,68,68,.35)}
  nav.skip a{position:absolute;left:-9999px}
  nav.skip a:focus{left:20px;top:10px;background:#fff;color:#000;padding:8px;border-radius:6px;z-index:999}

  table.summary{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}
  table.summary th, table.summary td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
  table.summary thead th{background:var(--table);text-align:left;color:var(--muted);font-size:13px}
  table.summary td.num{text-align:right}
  table.summary td.status{text-align:center;width:64px}
  table.summary td.failed-list{color:var(--muted)}
  .stage-link{font-weight:600}

  section.file{background:var(--panel);border-radius:14px;margin:18px 0;padding:16px;border:1px solid rgba(255,255,255,.06)}
  section.file h2{margin:0 0 8px;font-size:18px;display:flex;align-items:center;gap:8px}
  section.file h2 small{color:var(--muted);font-weight:400}

  .rules-group{margin:10px 0 0}
  .rules-group h3{margin:6px 0 8px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}

  .rule{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;margin:8px 0;background:rgba(255,255,255,.02)}
  .rule.compact{display:flex;align-items:center;gap:8px}
  .rule-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .rule.fail{border-color: rgba(239,68,68,.35);background: rgba(239,68,68,.06)}
  .rule.pass{border-color: rgba(34,197,94,.35);background: rgba(34,197,94,.06)}

  .kv{display:grid;grid-template-columns:120px 1fr;gap:10px;margin:6px 0}
  .kv>span{color:var(--muted)}
  .kv>ul{margin:0;padding-left:18px}
  .kv>ul .more{color:var(--muted);list-style: none;margin-left:-18px}

  details.source{margin-top:10px}
  details.source summary{cursor:pointer;color:var(--hl);outline:none}
  details.source .source-actions{display:flex;justify-content:flex-end;margin:6px 0}
  .copy-btn{background:var(--chip);border:1px solid rgba(255,255,255,.1);color:var(--ink);padding:4px 8px;border-radius:6px;cursor:pointer}
  .copy-btn:hover{filter:brightness(1.1)}
  pre{background:#0b0d13;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;overflow:auto}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace;font-size:12px;white-space:pre}
  .muted{color:var(--muted)}
  .backlinks{margin-top:8px}
  footer{margin:16px 0 40px;color:var(--muted)}
</style>
</head>
<body>
<nav class="skip"><a href="#summary">Skip to summary</a></nav>
<div class="wrap">
  <a id="top"></a>
  <header>
    <h1>📄 LLM Doc Linter Report</h1>
    <div class="meta">Generated ${esc(niceDate())}</div>
    <div class="chips" role="group" aria-label="Report meta">
      <span class="chip">Model: <strong>${esc(summary.model)}</strong></span>
      <span class="chip">Files: <strong>${summary.checked}</strong></span>
      <span class="chip ok">Passed: <strong>${summary.passed}</strong></span>
      <span class="chip bad">Failed: <strong>${summary.failed}</strong></span>
    </div>
  </header>

  <h2 id="summary">📊 Summary</h2>
  <p class="meta">This table summarizes all stages. Select a stage name to jump to its details.</p>
  <table class="summary" role="table" aria-label="Summary of all stages">
    <thead>
      <tr>
        <th scope="col" style="width:64px;text-align:center;">Status</th>
        <th scope="col">Stage</th>
        <th scope="col" style="text-align:right;">Passed</th>
        <th scope="col" style="text-align:right;">Failed</th>
        <th scope="col">Failed Rules</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRow}
    </tbody>
  </table>

  ${fileSections}

  <footer>End of report • <a href="#top">Back to top</a></footer>
</div>
<script>
  // Copy button handler
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-target');
    const el = document.getElementById(id);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent || '');
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1200);
    } catch {}
  });
</script>
</body>
</html>`;
}

/* ------------------------------ Write to disk ------------------------------ */

export async function writePrettyReport(
  summary: Summary,
  opts: PrettyReportOptions = {}
) {
  const format = (opts.format || 'md').toLowerCase(); // md | html | pdf | all
  const base = opts.outBasePath || path.resolve(process.cwd(), 'reports/lint');
  await fs.mkdir(path.dirname(base), { recursive: true });

  const formats = format === 'all' ? ['md', 'html', 'pdf'] : [format];

  for (const fmt of formats) {
    if (fmt === 'md') {
      const md = renderMarkdownReport(summary, opts);
      const p = `${base}.md`;
      await fs.writeFile(p, md, 'utf8');
      console.log(`📝 Wrote Markdown report to ${p}`);
    } else if (fmt === 'html') {
      const html = renderHtmlReport(summary, opts);
      const p = `${base}.html`;
      await fs.writeFile(p, html, 'utf8');
      console.log(`🖥️  Wrote HTML report to ${p}`);
    } else if (fmt === 'pdf') {
      // Minimal HTML → PDF via Puppeteer (optional dependency).
      // Install: `bun add -D puppeteer` (or Playwright).
      const html = renderHtmlReport(summary, opts);
      const pHtml = `${base}.html`;
      const pPdf = `${base}.pdf`;
      await fs.writeFile(pHtml, html, 'utf8');
      console.log(`🖥️  Wrote HTML (source for PDF) to ${pHtml}`);

      try {
        const { default: puppeteer } = await import('puppeteer');
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pPdf, format: 'A4', printBackground: true });
        await browser.close();
        console.log(`🧾 Wrote PDF report to ${pPdf}`);
      } catch (err) {
        console.warn(
          '⚠️  Could not generate PDF (is puppeteer installed?):',
          err
        );
      }
    } else {
      console.warn(`Unknown report format: ${fmt}`);
    }
  }
}
