#!/usr/bin/env bash
# Run the linter on a null-delimited filelist and never fail the step.
# Writes exit code to $OUT_EXITCODE and leaves reports in ./reports.
set -euo pipefail

: "${LINTER_DIR:?LINTER_DIR is required}"     # e.g. tools/llm-linter
: "${ZLIST:?ZLIST is required}"               # null-delimited list of files
: "${LLM_RULE_EVALUATOR_OPENAI_API_KEY:?LLM_RULE_EVALUATOR_OPENAI_API_KEY is required}"
: "${MODEL:=gpt-5}"
OUT_EXITCODE="${OUT_EXITCODE:-${GITHUB_OUTPUT:-/tmp/llm-lint.outputs}}"

cd "$LINTER_DIR"
mkdir -p reports

echo "📚 Files to lint:"
mapfile -d '' files < "$ZLIST"
for f in "${files[@]}"; do
  echo "  • $f"
done

set +e
bun run src/index.ts \
  --format html \
  --out reports/llm-lint \
  --report reports/lint.json \
  --include-source \
  --model "$MODEL" \
  "${files[@]}"
code=$?
set -e

echo "exitcode=$code" >> "$OUT_EXITCODE"
echo "Linter exit code: $code"
