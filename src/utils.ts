import path from 'node:path';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import matter from 'gray-matter';
import type { RuleResult, RuleSpec, Summary } from './types';

// ---------- Pretty logging ----------
export const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  white: (s: string) => `\x1b[97m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function padDots(label: string, width = 40) {
  const dots = Math.max(2, width - label.length);
  return label + ' '.repeat(dots).replace(/ /g, '.');
}

function ms(t: number) {
  return `${t} ms`;
}

// ---------- Helpers ----------

export async function runRuleWithLogs(
  id: string,
  builder: () => Promise<RuleResult>
): Promise<RuleResult> {
  const title = id;
  const label = `  ▶ ${title} `;
  const start = Date.now();
  process.stdout.write(color.white(padDots(label)));

  try {
    const res = await builder();
    const elapsed = Date.now() - start;
    const status = res.pass ? color.green('PASS') : color.red('FAIL');
    process.stdout.write(`${status}  ${color.gray('(' + ms(elapsed) + ')')}\n`);

    if (!res.pass) {
      // Show rationale and a couple of fix suggestions (if any)
      if (res.rationale) {
        console.log(color.yellow('      • rationale: ') + res.rationale);
      }
      if (Array.isArray(res.suggested_fixes) && res.suggested_fixes.length) {
        const firstTwo = res.suggested_fixes.slice(0, 2);
        for (const fix of firstTwo) {
          console.log(
            color.cyan('      • fix: ') +
              (typeof fix === 'string' ? fix : JSON.stringify(fix))
          );
        }
        if (res.suggested_fixes.length > 2) {
          console.log(
            color.cyan(
              `      • (+${res.suggested_fixes.length - 2} more suggestions)`
            )
          );
        }
      }
    }
    return res;
  } catch (e: any) {
    const elapsed = Date.now() - start;
    process.stdout.write(
      `${color.red('FAIL')}  ${color.gray('(' + ms(elapsed) + ')')}\n`
    );
    console.log(color.yellow('      • rationale: ') + String(e?.message || e));
    return {
      id,
      pass: false,
      rationale: String(e?.message || e),
      suggested_fixes: [],
    };
  }
}

export async function getTargets(ONLY?: string | null): Promise<string[]> {
  const pattern = ONLY || 'stage_descriptions/**/*.md';
  const files = await fg(pattern, { dot: false, onlyFiles: true });
  return files.map((f) => path.resolve(f)).sort();
}

export async function loadAllRules(dir: string): Promise<RuleSpec[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((d) => d.isFile())
    .map((d) => path.join(dir, d.name))
    .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));

  const rules: RuleSpec[] = [];
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data ?? {};
    const id =
      typeof fm.id === 'string' && fm.id.trim()
        ? fm.id.trim()
        : path.basename(filePath).replace(/\.(md|markdown)$/i, '');
    const severity: 'error' | 'warn' =
      fm.severity === 'warn' ? 'warn' : 'error';
    const summary =
      typeof fm.summary === 'string' ? (fm.summary as string) : undefined;

    rules.push({
      id,
      severity,
      summary,
      markdown: parsed.content.trim(),
      filePath,
    });
  }

  rules.sort((a, b) => a.id.localeCompare(b.id));
  return rules;
}

export function renderConsoleReport(summary: Summary) {
  const { model, checked, passed, failed, files } = summary;

  const header = [
    color.bold('📄 LLM Doc Linter Report'),
    '',
    `${color.dim('Model')}: ${color.bold(model)}`,
    `${color.dim('Files checked')}: ${color.bold(String(checked))}`,
    `${color.green(`${passed} passed`)}, ${color.red(`${failed} failed`)}`,
    '',
  ].join('\n');

  const perFile = files
    .map((f) => {
      const icon = f.overall_pass ? '✅' : '❌';
      const title =
        `${icon} ${color.bold(f.file)} ` +
        color.dim(
          `(${f.rules.filter((r) => r.pass).length} passed, ${
            f.rules.filter((r) => !r.pass).length
          } failed)`
        );

      const body = f.rules
        .map((r) => {
          const badge = r.pass ? color.green('PASS') : color.red('FAIL');
          const rationale = r.rationale
            ? `  ${color.dim('•')} ${r.rationale}`
            : '';
          let fixes = '';
          if (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length) {
            const list = r.suggested_fixes
              .map((x) => `    ${color.dim('→')} ${String(x)}`)
              .join('\n');
            fixes = `\n${list}`;
          }
          return `  ${badge}  ${color.bold(r.id)}\n${rationale}${fixes}`;
        })
        .join('\n');

      return `${title}\n${body}`;
    })
    .join('\n\n');

  console.log(header + perFile);
  console.log(
    '\n' + (failed ? color.red('Result: FAIL') : color.green('Result: PASS'))
  );
}
