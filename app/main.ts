import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { OpenAI } from 'openai';
import {
  color,
  extractFirstParagraph,
  getTargets,
  MODEL,
  REPORT_PATH,
  runRuleWithLogs,
  type FileResult,
  type RuleResult,
} from './utils';

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

// ---------- Per-rule micro-prompts ----------
// Add good and bad examples to each rule as needed.
function promptR1(file: string, hook: string) {
  return `
Judge ONLY this rule:

Rule: R1_HOOK_ONE_LINER
- The "hook" must be exactly ONE sentence that states what the learner will do in this stage.
- It should plausibly be <= 160 characters (soft cap).
Return JSON:
{"id":"R1_HOOK_ONE_LINER","pass":boolean,"rationale":string,"suggested_fixes":string[]}

File: ${file}
Hook to evaluate (verbatim):
---HOOK---
${hook}
---END---
`.trim();
}

// Split this
function promptR2(file: string, markdown: string) {
  return `
Judge ONLY this rule:

Rule: R2_SECTIONING
- After the hook, content must be organized into titled explanation section(s) (>= 1) that each cover a single topic.,
  then "### Tests" (must include what the tester will do and at least one expected output),
  then optional "### Notes" (if present, <= 3 bullet points - remember that each bullet point can be multiple sentences).
Return JSON:
{"id":"R2_SECTIONING","pass":boolean,"rationale":string,"suggested_fixes":any[]}

File: ${file}
Markdown:
---MD---
${markdown}
---END---
`.trim();
}

function promptR3(file: string, markdown: string) {
  return `
Judge ONLY this rule:

Rule: R3_EXAMPLES_EXPECTATIONS
- Check every Explanation section and determine whether examples (code or shell) are needed to clarify key concepts. Only include examples if they aid understanding of formats, structure, or expected behavior.
- Do NOT include examples or pseudocode that reveal full solutions or directly help the reader pass the stage. Code that shows input and expected output is acceptable if it clarifies format or structure.
- Favor conceptual or illustrative examples: simplified shell interactions, bulleted list that illustrates structure, or fake/mock data that demonstrates structure (e.g. showing a sample .torrent file layout or output format).
- If examples are needed in a section, ensure at least one interaction (e.g. shell command and/or expected output format) is shown to clarify behavior, **without solving the task** and give the example to pass the rule.
- In "Tests" sections, include exact tester commands and expected outputs, including precise formatting (e.g. expected RESP bytes, decoded values) where relevant.
Return JSON:
{"id":"R3_EXAMPLES_EXPECTATIONS","pass":boolean,"rationale":string,"suggested_fixes":any[]}

File: ${file}
Markdown:
---MD---
${markdown}
---END---
`.trim();
}

function promptR4(file: string, markdown: string) {
  return `
Judge ONLY this rule:

Rule: R4_DOMAIN_CORRECTNESS (Redis/RESP)
- Check that the code examples and content are correct according to your knowledge of the domain.
- Check that there are no internal contradictions in the content.
Return JSON:
{"id":"R4_DOMAIN_CORRECTNESS","pass":boolean,"rationale":string,"suggested_fixes":any[]}

File: ${file}
Markdown:
---MD---
${markdown}
---END---
`.trim();
}

function promptR5(file: string, markdown: string) {
  return `
Judge ONLY this rule:

Rule: R5_CLARITY_STYLE
- Tone: Friendly and approachable. User-centric & Empathetic. Neutral-professional — it doesn't get overly casual (no slang), but it avoids sounding stiff or academic.
- Style: Instructional → Clear step-by-step guidance on what the learner needs to do in this stage. Explanatory → Includes background context. Conversational → Uses second-person address (“you'll”, “your program should…”) to engage directly with the reader.
- Notes do not duplicate body content; if Notes exist, keep them focused (≤3).
- Provide the exact solution to fix clarity/style issues if you can that will pass the rule.
- Don't be too strict; if it's borderline, prefer PASS.
Return JSON:
{"id":"R5_CLARITY_STYLE","pass":boolean,"rationale":string,"suggested_fixes":any[]}

File: ${file}
Markdown:
---MD---
${markdown}
---END---
`.trim();
}

// ---------- Lint one file (per-rule calls) ----------
async function lintOne(file: string): Promise<FileResult> {
  const raw = await fs.readFile(file, 'utf8');
  const { content } = matter(raw);
  const hook = extractFirstParagraph(content) || '';

  console.log(color.bold(`\n📄 ${path.relative(process.cwd(), file)}`));

  const results: RuleResult[] = [];

  // R1: pass only the hook text
  const r1 = await runRuleWithLogs('R1_HOOK_ONE_LINER', async () => {
    try {
      const r1json = await callModel(promptR1(file, hook));
      const parsed = JSON.parse(r1json);
      // Ensure id is correct if model omits it
      parsed.id = 'R1_HOOK_ONE_LINER';
      return parsed;
    } catch (e: any) {
      return {
        id: 'R1_HOOK_ONE_LINER',
        pass: false,
        rationale: e?.insufficient_quota
          ? 'LLM call failed: insufficient quota.'
          : `LLM call failed: ${String(e?.message || e)}`,
        suggested_fixes: ['Verify API key/org; try again.'],
      };
    }
  });
  results.push(r1);

  // R2..R5
  const RULES: Array<[string, (f: string, md: string) => string]> = [
    ['R2_SECTIONING', promptR2],
    ['R3_EXAMPLES_EXPECTATIONS', promptR3],
    ['R4_DOMAIN_CORRECTNESS', promptR4],
    ['R5_CLARITY_STYLE', promptR5],
  ];

  for (const [id, builder] of RULES) {
    const rr = await runRuleWithLogs(id, async () => {
      try {
        const json = await callModel(builder(file, content));
        const parsed = JSON.parse(json);
        parsed.id = id;
        return parsed;
      } catch (e: any) {
        return {
          id,
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

  const out: FileResult[] = [];
  for (const f of targets) {
    try {
      const res = await lintOne(f);
      out.push(res);
    } catch (e: any) {
      out.push({
        file: f,
        overall_pass: false,
        rules: [
          {
            id: 'R0_ENGINE',
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
