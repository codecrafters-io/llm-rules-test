#!/usr/bin/env bash
# Collect stage_descriptions/*.md changed in this PR (via GitHub API),
# or fall back to "all files". Writes a null-delimited file list to $OUT_ZLIST.
set -euo pipefail

: "${REPO_NAME:?REPO_NAME is required}"                # e.g. build-your-own-redis
: "${OWNER_REPO:?OWNER_REPO is required}"              # e.g. codecrafters-io/build-your-own-redis
: "${COURSE_DIR:?COURSE_DIR is required}"              # e.g. $GITHUB_WORKSPACE/courses/build-your-own-redis
: "${OUT_ZLIST:?OUT_ZLIST is required}"                # e.g. $GITHUB_WORKSPACE/targets.zlist
: "${EVENT_NAME:?EVENT_NAME is required}"              # e.g. ${{ github.event_name }}
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"

mkdir -p "$(dirname "$OUT_ZLIST")"
> "$OUT_ZLIST"

if [[ "$EVENT_NAME" == "pull_request" ]]; then
  : "${PR_NUMBER:?PR_NUMBER is required for pull_request}"

  echo "🔎 Using GitHub API to list changed files for PR #$PR_NUMBER"
  files=()
  page=1
  while :; do
    resp="$(curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" \
      "https://api.github.com/repos/${OWNER_REPO}/pulls/${PR_NUMBER}/files?per_page=100&page=$page")"
    page_files="$(echo "$resp" | jq -r '.[].filename')"
    [[ -z "$page_files" ]] && break
    while IFS= read -r f; do
      [[ -n "$f" ]] && files+=("$f")
    done <<< "$page_files"
    (( ${#files[@]} < 100*page )) && break
    ((page++))
  done

  # Filter to stage_descriptions
  targets=()
  for f in "${files[@]}"; do
    [[ "$f" == stage_descriptions/*.md || "$f" == stage_descriptions/**/*.md ]] && targets+=("$f")
  done

  if ((${#targets[@]} == 0)); then
    echo "none=true" >> "$GITHUB_OUTPUT"
    echo "No changed stage files."
    exit 0
  fi

  # Make absolute for the linter
  abs=()
  for f in "${targets[@]}"; do
    abs+=( "$COURSE_DIR/$f" )
  done
  printf '%s\0' "${abs[@]}" > "$OUT_ZLIST"

  echo "none=false" >> "$GITHUB_OUTPUT"
  echo "zlist=$OUT_ZLIST" >> "$GITHUB_OUTPUT"
  echo "Found ${#abs[@]} changed stage file(s)."
  exit 0
fi
