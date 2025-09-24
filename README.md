This repository is used to enforce atomic Markdown rules against course stage descriptions (e.g. `stage_descriptions/**/*.md`). It can be run:
- **Locally**, for quick checks while editing stage descriptions.  
- **In CI/CD**, where it integrates with other repos to lint only changed files in pull requests.

## ✨ Features

- **Atomic Markdown rules**: each rule lives in `rules/*.md` with front-matter and examples.
- **LLM evaluation**: rules are checked by OpenAI models (default: `o3`).
- **Deterministic output**: runner enforces strict JSON schema for each rule result.
- **CI integration**: checks only changed `stage_descriptions/**/*.md` files in PRs.
- **PR feedback**: posts a sticky comment with pass/fail results and suggested fixes.

## 🚀 Usage

### Install dependencies

```bash
bun install
````

### Run locally

Lint all targets (default `stage_descriptions/`):

```bash
bun run dev
```

Lint specific files:

```bash
bun run dev path/to/file1.md path/to/file2.md
```

### Environment variables

* `OPENAI_API_KEY` (required)
* `MODEL` (default: `o3`)
* `REPORT_PATH` (optional; write JSON report here)

Example:

```bash
MODEL=gpt-5 bun run dev stage_descriptions/02-blpop-timeout.md
```

## 🛠 Development

* Add new rules in `rules/`, each self-contained and unambiguous.
* Include **Good** and **Bad** examples and a **How to fix** section.
* Run locally before pushing:
  ```bash
  bun run dev stage_descriptions/example.md
  ```
