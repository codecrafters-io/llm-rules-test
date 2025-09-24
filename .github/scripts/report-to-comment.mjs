import fs from 'node:fs';

const path = process.argv[2] || 'reports/lint.json';
if (!fs.existsSync(path)) {
  console.log(`❓ No report found at \`${path}\`.`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const lines = [];

lines.push(`## 📄 LLM Doc Linter Report`);
lines.push('');
lines.push(
  `**Model:** \`${data.model}\` &nbsp;|&nbsp; **Files checked:** ${data.checked} &nbsp;|&nbsp; **Passed:** ${data.passed} &nbsp;|&nbsp; **Failed:** ${data.failed}`
);
lines.push('');

for (const f of data.files) {
  const status = f.overall_pass ? '✅' : '❌';
  lines.push(`### ${status} \`${f.file}\``);

  const failedRules = f.rules.filter((r) => !r.pass);
  if (failedRules.length === 0) {
    lines.push(`All rules passed.`);
    lines.push('');
    continue;
  }

  for (const r of failedRules) {
    lines.push(`- **${r.id}** — ${r.rationale || 'No rationale provided.'}`);
    if (r.suggested_fixes && r.suggested_fixes.length) {
      const fixes = r.suggested_fixes
        .map((x) => `    - ${String(x)}`)
        .join('\n');
      lines.push(`  **Suggested fixes:**\n${fixes}`);
    }
  }
  lines.push('');
}

console.log(lines.join('\n'));
