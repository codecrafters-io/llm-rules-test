import path from 'node:path';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import matter from 'gray-matter';
import type {
  CLIOpts,
  RuleLogOpts,
  RuleResult,
  RuleSpec,
  Summary,
  SummaryRenderOptions,
} from './types';

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

function ms(t: number) {
  return `${t} ms`;
}

// ---------- Helpers ----------

export function parseCLI(argv: string[]): CLIOpts {
  const opts: CLIOpts = {
    positional: [],
    format: (process.env.REPORT_FORMAT as any) || 'md',
    outBase: process.env.REPORT_OUT || null,
    model: process.env.LLM_LINT_MODEL || null,
    reportPath: process.env.REPORT_PATH || null,
    showPassDetails: false,
    fileConcurrency: process.env.FILE_CONCURRENCY
      ? Number(process.env.FILE_CONCURRENCY)
      : undefined,
    ruleConcurrency: process.env.RULE_CONCURRENCY
      ? Number(process.env.RULE_CONCURRENCY)
      : undefined,
    noReport: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--only':
        opts.only = argv[++i];
        break;
      case '--report':
        opts.reportPath = argv[++i];
        break;
      case '--model':
        opts.model = argv[++i];
        break;
      case '--format':
        opts.format = (argv[++i] as any) || 'md';
        break;
      case '--out':
        opts.outBase = argv[++i];
        break;
      case '--show-pass-details':
      case '--show-pass-rationale':
        opts.showPassDetails = true;
        break;
      case '--file-concurrency':
        opts.fileConcurrency = Number(argv[++i]);
        break;
      case '--rule-concurrency':
        opts.ruleConcurrency = Number(argv[++i]);
        break;
      case '--no-report':
        opts.noReport = true;
        break;
      default:
        if (a?.startsWith('-')) {
          throw new Error(`Unknown flag: ${a}`);
        }
        opts.positional.push(a); // treat as file path
    }
  }
  return opts;
}

// prettier, compact rule-level log
export async function runRuleWithLogs(
  id: string,
  builder: () => Promise<RuleResult>,
  opts: RuleLogOpts = {}
): Promise<RuleResult> {
  const start = Date.now();
  const fileLabel = opts.filePath
    ? color.dim(`[${path.basename(opts.filePath)}]`)
    : color.dim('[rule]');

  try {
    const res = await builder();
    const elapsed = ms(Date.now() - start);
    const status = res.pass ? color.green('PASS') : color.red('FAIL');

    // Build one atomic block so lines don't interleave
    const lines: string[] = [];
    lines.push(
      `  ${fileLabel} ${color.bold('▶')} ${color.bold(
        id
      )}  ${status}  ${color.gray(`(${elapsed})`)}`
    );

    // Details on failure; optionally for pass when requested
    const shouldShowDetails = !res.pass || opts.showPassDetails;

    if (shouldShowDetails) {
      const indent = '      '; // 6 spaces to align nicely
      const yellowBullet = color.yellow('•');
      const cyanBullet = color.cyan('•');

      if (res.rationale) {
        lines.push(
          `${indent}${yellowBullet} ${color.yellow('rationale:')} ${
            res.rationale
          }`
        );
      }
      if (Array.isArray(res.suggested_fixes) && res.suggested_fixes.length) {
        const show = res.suggested_fixes.slice(0, 3);
        for (const fx of show) {
          lines.push(
            `${indent}${cyanBullet} ${color.cyan('fix:')} ${
              typeof fx === 'string' ? fx : JSON.stringify(fx)
            }`
          );
        }
        const extra = res.suggested_fixes.length - show.length;
        if (extra > 0) {
          lines.push(
            `${indent}${color.cyan(
              `(+${extra} more suggestion${extra > 1 ? 's' : ''})`
            )}`
          );
        }
      }
    }

    console.log(lines.join('\n'));
    return res;
  } catch (e: any) {
    const elapsed = ms(Date.now() - start);
    const lines: string[] = [];
    lines.push(
      `  ${fileLabel} ${color.bold('▶')} ${color.bold(id)}  ${color.red(
        'FAIL'
      )}  ${color.gray(`(${elapsed})`)}`
    );
    lines.push(
      `      ${color.dim('•')} ${color.yellow('rationale:')} ${String(
        e?.message || e
      )}`
    );
    console.log(lines.join('\n'));

    return {
      id,
      pass: false,
      rationale: String(e?.message || e),
      suggested_fixes: [],
    };
  }
}

// elegant, high-contrast final report
export function renderConsoleReport(
  summary: Summary,
  opts: SummaryRenderOptions = {}
) {
  const { model, checked, passed, failed, files } = summary;
  const { showPassDetails = false } = opts;

  const hr = color.dim('─'.repeat(70));
  const title = `${color.bold('📄  LLM Doc Linter Report')}`;
  const meta =
    `${color.dim('Model')}: ${color.bold(model)}  ${color.dim('•')} ` +
    `${color.dim('Files')}: ${color.bold(String(checked))}  ${color.dim(
      '•'
    )} ` +
    `${color.green(`${passed} passed`)}  ${color.dim('•')} ${color.red(
      `${failed} failed`
    )}`;

  const indent = '      ';
  const yellowBullet = color.yellow('•');
  const cyanBullet = color.cyan('•');

  console.log('\n' + hr);
  console.log(title);
  console.log(meta);
  console.log(hr);

  for (const f of files) {
    const fileIcon = f.overall_pass ? color.green('✅') : color.red('❌');
    const passedCount = f.rules.filter((r) => r.pass).length;
    const failedCount = f.rules.length - passedCount;

    const fileHeader =
      `${fileIcon} ${color.bold(f.file)}  ` +
      color.dim(`(${passedCount} passed, ${failedCount} failed)`);

    console.log('\n' + fileHeader);

    // Failed first (always detailed)
    const failedRules = f.rules.filter((r) => !r.pass);
    if (failedRules.length) {
      console.log(`  ${color.red('Failed rules:')}`);
      for (const r of failedRules) {
        console.log(`    ${color.red('✖')} ${color.bold(r.id)}`);

        if (r.rationale) {
          console.log(
            `${indent}${yellowBullet} ${color.yellow('rationale:')} ${
              r.rationale
            }`
          );
        }
        if (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length) {
          const show = r.suggested_fixes.slice(0, 3);
          for (const fx of show) {
            console.log(
              `${indent}${cyanBullet} ${color.cyan('fix:')} ${
                typeof fx === 'string' ? fx : JSON.stringify(fx)
              }`
            );
          }
          const extra = r.suggested_fixes.length - show.length;
          if (extra > 0) {
            console.log(
              `${indent}${color.cyan(
                `(+${extra} more suggestion${extra > 1 ? 's' : ''})`
              )}`
            );
          }
        }
      }
    }

    // Passed next
    const passedRules = f.rules.filter((r) => r.pass);
    if (passedRules.length) {
      console.log(`  ${color.green('Passed rules:')}`);
      for (const r of passedRules) {
        console.log(`    ${color.green('✔')} ${color.bold(r.id)}`);

        if (showPassDetails) {
          if (r.rationale) {
            console.log(
              `${indent}${yellowBullet} ${color.yellow('rationale:')} ${
                r.rationale
              }`
            );
          }
          if (Array.isArray(r.suggested_fixes) && r.suggested_fixes.length) {
            const show = r.suggested_fixes.slice(0, 2);
            for (const fx of show) {
              console.log(
                `${indent}${cyanBullet} ${color.cyan('fix:')} ${
                  typeof fx === 'string' ? fx : JSON.stringify(fx)
                }`
              );
            }
            const extra = r.suggested_fixes.length - show.length;
            if (extra > 0) {
              console.log(
                `${indent}${color.cyan(
                  `(+${extra} more suggestion${extra > 1 ? 's' : ''})`
                )}`
              );
            }
          }
        }
      }
    }
  }

  console.log('\n' + hr);
  console.log(failed ? color.red('Result: FAIL') : color.green('Result: PASS'));
  console.log(hr + '\n');
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
