#!/usr/bin/env bun
import { readFileSync, existsSync } from 'node:fs';

const p = 'reports/lint.json';
if (!existsSync(p)) {
  console.log('');
  process.exit(0);
}
const d = JSON.parse(readFileSync(p, 'utf8'));

const totalRules = d.files.reduce((a, f) => a + f.rules.length, 0);
const failedRules = d.files.reduce(
  (a, f) => a + f.rules.filter((r) => !r.pass).length,
  0
);
const passedRules = totalRules - failedRules;

const lines = [];
lines.push('## LLM Doc Lint');
lines.push('');
lines.push(`${totalRules} tests   ${passedRules} ✅  ${failedRules} ❌`);
lines.push(`\n${d.files.length} suites`);
lines.push('');
lines.push(
  `Results for commit \`${process.env.GITHUB_SHA?.slice(0, 7) || ''}\`.`
);
lines.push('');
lines.push('_This comment updates automatically on new commits._');
lines.push('');
lines.push('<!-- llm-doc-lint:anchor -->');

console.log(lines.join('\n'));
