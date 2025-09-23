import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { OpenAI } from 'openai';
import {
  color,
  getTargets,
  MODEL,
  REPORT_PATH,
  runRuleWithLogs,
  type FileResult,
  type RuleResult,
} from './utils';
import { loadAllRules, type RuleSpec } from './rule-loader';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// One LLM call with retry/backoff; throws on insufficient_quota
async function callModel(prompt: string) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  while (true) {
    try {
      const resp = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a strict, deterministic doc linter. Return ONLY valid JSON.',
          },
          { role: 'user', content: prompt },
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
 * Build a deterministic, per-rule prompt by combining the rule's micro_prompt
 * with the target file path & full Markdown content.
 *
 * NOTE: We no longer slice out the "hook" or any specific section here.
 * If a rule needs the hook, its `micro_prompt` should instruct the model
 * how to locate/evaluate it from the full content.
 */
function buildPrompt(rule: RuleSpec, filePath: string, markdown: string) {
  return `
${rule.micro_prompt.trim()}

File: ${filePath}
Markdown:
---MD---
${markdown}
---END---
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
        // ensure the id matches our rule id, even if the model omits/changes it
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
  const targets = await getTargets();
  if (targets.length === 0) {
    console.log("No Markdown files found under 'stages/'.");
    process.exit(0);
  }

  // Load all atomic rules from the flat rules/ directory
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

  process.exit(out.some((r) => !r.overall_pass) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
