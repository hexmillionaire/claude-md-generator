# Changelog

## Unreleased

- Security: output files are never written through a symlink. A cloned repository could plant `CLAUDE.md`, `CLAUDE.generated.md` or `AGENTS.md` as a link to any file on the machine (git preserves symlinks); the tool now `lstat`s the target, refuses links and non-regular files, creates new files exclusively, and replaces existing ones with `--force` via a sibling temp file and atomic rename.
- Security: every string read from the scanned repository (package name and description, script names and commands, dependency versions, `tsconfig` paths, `components.json` aliases, `.env.example` comments, workflow names) is flattened to one line, stripped of leading Markdown syntax and backticks, and length-capped before rendering. A repository can no longer inject headings or instructions into the generated agent file.
- Fix: a non-array `"workspaces"` in `package.json` no longer crashes the generator.
- Security: config files the scanner reads whole (`pyproject.toml`, `requirements.txt`, `Makefile`, `.env.example`, workflow files, `go.mod`, …) are now read at most 1 MB deep, matching the cap the source walk already had. A planted multi-gigabyte file can no longer stall the scan or exhaust memory.

## 0.1.1 — 2026-10-15

- Fix: env var source paths use forward slashes on Windows, so the generated file is identical across platforms.
- Fix: `npm test` works on Node 18 and 20 (named test files instead of a glob Node only expands from 21).
- Add: `skills/claude-md/SKILL.md`, a Claude Code skill that runs the generator, infers invariants from git history and asks for the rest.
- Add: `llms.txt`, SECURITY.md, CONTRIBUTING.md, issue templates.
- CI: Node 18/20/22/24 plus Windows and macOS; actions pinned to commit SHAs; read-only permissions.

## 0.1.0 — 2026-10-15

First release.
