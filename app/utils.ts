import path from 'node:path';
import fg from 'fast-glob';
import crypto from 'node:crypto';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit, EXIT } from 'unist-util-visit';

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
  MODEL_IDX >= 0
    ? args[MODEL_IDX + 1]
    : process.env.LLM_LINT_MODEL || 'gpt-4o-mini';

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

// Extract first non-empty paragraph (the “hook”), ignoring headings.
export function extractFirstParagraph(md: string): string | null {
  const tree = unified().use(remarkParse).parse(md);
  let para: string | null = null;
  visit(tree, (node: any) => {
    if (para) return EXIT;
    if (node.type === 'paragraph') {
      let text = '';
      visit(node, (n: any) => {
        if (
          n.type === 'text' ||
          n.type === 'inlineCode' ||
          n.type === 'emphasis' ||
          n.type === 'strong' ||
          n.type === 'link'
        ) {
          text += n.value || n.title || '';
        }
      });
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > 0) para = text;
    }
  });
  return para;
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
