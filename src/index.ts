import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { OpenAI } from 'openai';
import { color, getTargets, loadAllRules, runRuleWithLogs } from './utils';
import type { FileResult, RuleResult, RuleSpec } from './types';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set.');
  process.exit(2);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const defaultModel = 'o3';

// ---------- CLI args ----------
const args = process.argv.slice(2);
const ONLY_IDX = args.indexOf('--only');
const ONLY = ONLY_IDX >= 0 ? args[ONLY_IDX + 1] : null;
const REPORT_IDX = args.indexOf('--report');
const REPORT_PATH = REPORT_IDX >= 0 ? args[REPORT_IDX + 1] : null;
const MODEL_IDX = args.indexOf('--model');
const MODEL =
  MODEL_IDX >= 0
    ? args[MODEL_IDX + 1]
    : process.env.LLM_LINT_MODEL || defaultModel;

// One LLM call with retry/backoff; throws on insufficient_quota
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
 * Build a single generic prompt. We no longer use per-rule micro_prompts.
 * - Feed the ENTIRE rule Markdown (so the model sees Rule, Good/Bad examples, How to fix).
 * - Feed the ENTIRE target file Markdown.
 * - Instruct the model to apply ONLY the criteria in the rule doc and return the standard JSON.
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

// ---------- Lint one file (dynamic rules) ----------
async function lintOne(file: string, rules: RuleSpec[]): Promise<FileResult> {
  const raw = await fs.readFile(file, 'utf8');
  const { content } = matter(raw);

  console.log(color.bold(`\n📄 ${path.relative(process.cwd(), file)}`));

  const results: RuleResult[] = [];

  for (const rule of rules) {
    const rr = await runRuleWithLogs(rule.id, async () => {
      try {
        const prompt = buildPrompt(rule, file, content);
        const json = await callModel(prompt);
        const parsed = JSON.parse(json);
        parsed.id = rule.id; // enforce stable id
        return parsed;
      } catch (e: any) {
        return {
          id: rule.id,
          pass: false,
          rationale: e?.insufficient_quota
            ? 'LLM call failed: insufficient quota.'
            : `LLM call failed: ${String(e?.message || e)}`,
          suggested_fixes: ['Verify API key/org; try again.'],
        };
      }
    });
    results.push(rr);
  }

  const passCount = results.filter((r) => r.pass).length;
  const summaryEmoji = passCount === results.length ? '✅' : '❌';
  console.log(
    `  └ Summary: ${passCount}/${results.length} passed  ${summaryEmoji}`
  );

  const overall_pass = results.every((r) => r.pass);
  return { file, overall_pass, rules: results };
}

// ---------- Main ----------
async function main() {
  const cliTargets = process.argv.slice(2).filter(Boolean);
  const targets = cliTargets.length ? cliTargets : await getTargets(ONLY);

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

  const out: FileResult[] = [];
  for (const f of targets) {
    try {
      const res = await lintOne(f, rules);
      out.push(res);
    } catch (e: any) {
      out.push({
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
      });
    }
  }

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
    console.log(`Wrote report to ${REPORT_PATH}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }

  const failed = out.filter((r) => !r.overall_pass).length;
  const checked = out.length;
  console.log(
    `\n${
      failed
        ? color.red('Final: ' + failed + ' failed')
        : color.green('Final: 0 failed')
    } / ${checked} checked`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
