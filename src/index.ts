import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { OpenAI } from 'openai';
import {
  color,
  getTargets,
  loadAllRules,
  parseCLI,
  renderConsoleReport,
  runRuleWithLogs,
} from './utils';
import type { FileResult, RuleResult, RuleSpec } from './types';
import { writePrettyReport } from './reporters';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set.');
  process.exit(2);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'reports/lint.json');

// ---------- CLI args ----------
const argv = process.argv.slice(2);
const cli = parseCLI(argv);

const MODEL = cli.model || DEFAULT_MODEL;
const REPORT_PATH = cli.noReport ? null : cli.reportPath || DEFAULT_REPORT_PATH;
const PRETTY_FORMAT = cli.format || 'md'; // md | html | pdf | all
const PRETTY_OUT = cli.outBase || path.resolve(process.cwd(), 'reports/lint');
const SHOW_PASS_DETAILS = !!cli.showPassDetails;
const DEFAULT_FILE_CONCURRENCY = 100;
const DEFAULT_RULE_CONCURRENCY = 50;
const FILE_CONCURRENCY = Math.max(
  1,
  Number(cli.fileConcurrency ?? DEFAULT_FILE_CONCURRENCY)
);
const RULE_CONCURRENCY = Math.max(
  1,
  Number(cli.ruleConcurrency ?? DEFAULT_RULE_CONCURRENCY)
);
const ONLY = cli.only || null;
const INCLUDE_SOURCE = !!cli.includeSource;
const EXPAND_SOURCE = !!cli.expandSource;

// ---------- Small, dependency-free promise pool ----------
async function runPool<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length) as any;
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) break;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

// ---------- OpenAI call with retry/backoff ----------
async function callModel(userContent: string) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  while (true) {
    try {
      const resp = await client.chat.completions.create({
        model: MODEL,
        temperature: 1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a strict, deterministic doc linter. Return ONLY valid JSON that matches the requested schema.',
          },
          { role: 'user', content: userContent },
        ],
      });
      return resp.choices[0].message!.content!;
    } catch (err: any) {
      const code = err?.status;
      const type = err?.error?.type || err?.type;
      attempt++;

      if (type === 'insufficient_quota' || code === 402) {
        const e = new Error('INSUFFICIENT_QUOTA');
        (e as any).insufficient_quota = true;
        throw e;
      }
      if ((code === 429 || (code && code >= 500)) && attempt < MAX_RETRIES) {
        const backoff = 300 * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Build a single generic prompt.
 * - Feed the ENTIRE rule Markdown (so the model sees Rule, Good/Bad examples, How to fix).
 * - Feed the ENTIRE target file Markdown.
 */
function buildPrompt(rule: RuleSpec, filePath: string, fileMarkdown: string) {
  return `
You are evaluating a single lint rule described in a Markdown document.
Apply ONLY the criteria specified in that rule document (including how to count/locate elements).
Return ONLY valid JSON with this exact schema:
{"id":"${rule.id}","pass":boolean,"rationale":string,"suggested_fixes":any[]}

--- RULE DOCUMENT (Markdown) START ---
${rule.markdown}
--- RULE DOCUMENT (Markdown) END ---

--- TARGET FILE PATH ---
${filePath}
--- TARGET FILE CONTENT (Markdown) START ---
${fileMarkdown}
--- TARGET FILE CONTENT (Markdown) END ---
`.trim();
}

// ---------- Lint one file (rules run in PARALLEL with a limit) ----------
async function lintOne(file: string, rules: RuleSpec[]): Promise<FileResult> {
  const raw = await fs.readFile(file, 'utf8');
  const { content } = matter(raw);

  console.log(color.bold(`\n📄 ${path.relative(process.cwd(), file)}`));

  // Create a task per rule; each task returns RuleResult
  const tasks = rules.map((rule) => {
    return async () => {
      const rr = await runRuleWithLogs(
        rule.id,
        async () => {
          try {
            const prompt = buildPrompt(rule, file, content);
            const json = await callModel(prompt);
            const parsed = JSON.parse(json);
            parsed.id = rule.id;
            return parsed;
          } catch (e: any) {
            return {
              id: rule.id,
              pass: false,
              rationale: e?.insufficient_quota
                ? 'LLM call failed: insufficient quota.'
                : `LLM call failed: ${String(e?.message || e)}`,
              suggested_fixes: ['Verify API key/org; try again.'],
            } as RuleResult;
          }
        },
        { filePath: file }
      );
      return rr;
    };
  });

  const results: RuleResult[] = await runPool(tasks, RULE_CONCURRENCY);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const summaryEmoji = failed === 0 ? '✅' : '❌';
  console.log(
    `  ${color.dim(`[${path.basename(file)}]`)} ${color.bold(
      '▶ Summary'
    )}: ${passed} passed, ${failed} failed  ${summaryEmoji}`
  );

  const overall_pass = failed === 0;
  return { file, overall_pass, rules: results, source: content };
}

// ---------- Main (files run in PARALLEL with a limit) ----------
async function main() {
  // Allow passing explicit file paths (first non-flag args)
  const explicitTargets = cli.positional;
  const targets = explicitTargets.length
    ? explicitTargets
    : await getTargets(ONLY);

  if (targets.length === 0) {
    console.log(
      "No Markdown files found under 'stage_descriptions/' or no CLI targets provided."
    );
    process.exit(0);
  }

  const rules = await loadAllRules(path.resolve(process.cwd(), 'rules'));
  if (rules.length === 0) {
    console.log("No rules found under 'rules/'. Nothing to do.");
    process.exit(1);
  }

  // Build file-level tasks
  const fileTasks = targets.map((f) => {
    return async (): Promise<FileResult> => {
      try {
        return await lintOne(f, rules);
      } catch (e: any) {
        return {
          file: f,
          overall_pass: false,
          rules: [
            {
              id: 'engine_error',
              pass: false,
              rationale: `Engine error: ${String(e?.message || e)}`,
              suggested_fixes: [],
            },
          ],
        };
      }
    };
  });

  // Run files in parallel with limit
  const out: FileResult[] = await runPool(fileTasks, FILE_CONCURRENCY);

  const summary = {
    model: MODEL,
    checked: out.length,
    passed: out.filter((r) => r.overall_pass).length,
    failed: out.filter((r) => !r.overall_pass).length,
    files: out,
  };

  if (REPORT_PATH) {
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`📦 Wrote JSON summary to ${REPORT_PATH}`);
  }

  renderConsoleReport(summary, { showPassDetails: SHOW_PASS_DETAILS });
  await writePrettyReport(summary, {
    format: PRETTY_FORMAT,
    outBasePath: PRETTY_OUT,
    showPassDetails: SHOW_PASS_DETAILS,
    includeSource: INCLUDE_SOURCE,
    expandSource: EXPAND_SOURCE,
  });

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
