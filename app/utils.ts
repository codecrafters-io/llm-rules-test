import path from 'node:path';
import fg from 'fast-glob';
import crypto from 'node:crypto';

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

const RULE_TITLES: Record<string, string> = {
  R1_HOOK_ONE_LINER: 'Hook one-liner',
  R2_SECTIONING: 'Sectioning & order',
  R3_EXAMPLES_EXPECTATIONS: 'Examples & expectations',
  R4_DOMAIN_CORRECTNESS: 'Domain correctness',
  R5_CLARITY_STYLE: 'Clarity & style',
  R0_ENGINE: 'Engine/infra',
};

export async function runRuleWithLogs(
  id: string,
  builder: () => Promise<RuleResult>
): Promise<RuleResult> {
  const title = RULE_TITLES[id] || id;
  const label = `  ▶ ${title} `;
  const start = Date.now();
  process.stdout.write(padDots(label));

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

// ---------- CLI args ----------
const args = process.argv.slice(2);
const ONLY_IDX = args.indexOf('--only');
const ONLY = ONLY_IDX >= 0 ? args[ONLY_IDX + 1] : null;
const REPORT_IDX = args.indexOf('--report');
export const REPORT_PATH = REPORT_IDX >= 0 ? args[REPORT_IDX + 1] : null;
const MODEL_IDX = args.indexOf('--model');
export const MODEL =
  MODEL_IDX >= 0 ? args[MODEL_IDX + 1] : process.env.LLM_LINT_MODEL || 'o3';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set.');
  process.exit(2);
}

// ---------- Helpers ----------
export type RuleResult = {
  id: string;
  pass: boolean;
  rationale: string;
  suggested_fixes: any[];
};

export type FileResult = {
  file: string;
  overall_pass: boolean;
  rules: RuleResult[];
};

export async function getTargets(): Promise<string[]> {
  const pattern = ONLY || 'stages/**/*.md';
  const files = await fg(pattern, { dot: false, onlyFiles: true });
  return files.map((f) => path.resolve(f)).sort();
}

export function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Initial R3
// - At least one example interaction in Explanation (shell block) showing command AND human-readable output.
// - "Tests" must include exact tester commands and exact expected RESP bytes when relevant.
// - Examples and Tests must be consistent.

// Rule: R3_EXAMPLES_EXPECTATIONS
// - Check every explanation section and determine whether examples (code or shell examples) in Explanation are needed based on the content and provide any suggestions for improvement.
// - If it is needed, check that at least one example interaction in Explanation (shell block) is showing the required command AND/OR human-readable output.
// - "Tests" must include exact tester commands and exact ouput required including the format (e.g expected RESP bytes) when relevant.

// Judge ONLY this rule:
// - RESP types are correct per command and stage (e.g., PING → +PONG\\r\\n, ECHO → Bulk String, GET miss → $-1\\r\\n, RPUSH/LPUSH → :<len>\\r\\n,
//   BLPOP success → array of 2 bulk strings [key, value], BLPOP timeout → *-1\\r\\n (null array), PX is ms, EX is s,
//   LRANGE: 0-based indexes, inclusive stop, negative index semantics).
// - No internal contradictions.

// Rule: R4_DOMAIN_CORRECTNESS
// - Check that the code examples and content are correct according to your knowledge of the domain.
// - Check that there are no internal contradictions in the content.

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
