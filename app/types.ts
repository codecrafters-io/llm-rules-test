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

export type RuleSpec = {
  id: string; // from front-matter or file name fallback
  severity: 'error' | 'warn'; // controls CI behavior if you choose
  summary?: string;
  markdown: string; // full rule Markdown (no micro_prompt anymore)
  filePath: string;
};
