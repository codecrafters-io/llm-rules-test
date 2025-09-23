// src/rule-loader.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export type RuleSpec = {
  id: string; // from front-matter or file name (fallback)
  severity: 'error' | 'warn'; // used for display/CI decisions if needed
  summary?: string;
  micro_prompt: string; // exact prompt sent before file/markdown payload
  filePath: string; // absolute path (for debugging)
};

function isRuleSpecLike(data: any): data is Omit<RuleSpec, 'filePath'> {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.micro_prompt === 'string' &&
    typeof (data.id ?? '') === 'string'
  );
}

/**
 * Load and validate all atomic Markdown rules from a flat directory.
 * - Each file must contain front-matter with at least `micro_prompt`.
 * - `id` is required; if missing, we derive it from the file name (without ext).
 * - `severity` defaults to "error" if not provided.
 */
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
    const fm = parsed.data || {};

    if (!isRuleSpecLike(fm)) {
      // attempt to recover id from filename if micro_prompt exists
      if (typeof fm.micro_prompt === 'string') {
        const idFromName = path
          .basename(filePath)
          .replace(/\.(md|markdown)$/i, '');
        rules.push({
          id: idFromName,
          severity:
            fm.severity === 'warn' || fm.severity === 'error'
              ? fm.severity
              : 'error',
          summary: typeof fm.summary === 'string' ? fm.summary : undefined,
          micro_prompt: fm.micro_prompt,
          filePath,
        });
        continue;
      }
      // skip invalid rule files silently, or throw if you prefer hard-fail:
      // throw new Error(`Invalid rule file (missing id/micro_prompt): ${filePath}`);
      continue;
    }

    rules.push({
      id: fm.id || path.basename(filePath).replace(/\.(md|markdown)$/i, ''),
      severity:
        fm.severity === 'warn' || fm.severity === 'error'
          ? fm.severity
          : 'error',
      summary: typeof fm.summary === 'string' ? fm.summary : undefined,
      micro_prompt: fm.micro_prompt,
      filePath,
    });
  }

  // Optional: sort to make outputs stable (alphabetical by id)
  rules.sort((a, b) => a.id.localeCompare(b.id));
  return rules;
}
