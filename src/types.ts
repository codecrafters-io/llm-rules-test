export type CLIOpts = {
  only?: string | null;
  reportPath?: string | null;
  model?: string | null;
  format?: 'md' | 'html' | 'pdf' | 'all';
  outBase?: string | null;
  showPassDetails?: boolean;
  fileConcurrency?: number;
  ruleConcurrency?: number;
  noReport?: boolean;
  positional: string[]; // files
};

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

export type RuleLogOpts = {
  filePath?: string; // e.g., 'stage_descriptions/lists-10.md'
  showPassDetails?: boolean; // if true, show rationale/fixes even on PASS
};

export type Summary = {
  model: string;
  checked: number;
  passed: number;
  failed: number;
  files: FileResult[];
};

export type SummaryRenderOptions = {
  showPassDetails?: boolean; // default false
};

export type PrettyReportOptions = {
  // 'md' | 'html' | 'pdf' | 'all'
  format?: string;
  // file basename, extension will be added per format
  outBasePath?: string;
  // when true, include rationale/fixes for passed rules
  showPassDetails?: boolean;
};
