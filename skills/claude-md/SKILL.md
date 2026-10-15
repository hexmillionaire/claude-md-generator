---
name: claude-md
description: Create or improve a repository's CLAUDE.md (or AGENTS.md) — the file coding agents read at the start of every session. Use when the user asks to write, generate, update, audit or shorten CLAUDE.md/AGENTS.md, or says the agent keeps getting the project wrong.
---

# Write a CLAUDE.md that agents actually use

A good CLAUDE.md has two halves. The **facts** (stack, commands, layout, env
vars) are mechanical; generate them. The **judgment** (invariants that break
silently, where new things go) only the project knows; dig it out of the repo
and ask the user. Keep the result under ~150 lines — it is read in full every
session.

## 1. Draft the facts

```bash
npx -y claude-md-generator --print > /tmp/claude-md-draft.md
```

Use `--json` instead if you need to see why something was or wasn't detected.
Never overwrite an existing `CLAUDE.md`: read it first, and merge the draft's
facts into it, keeping every hand-written line unless the user says otherwise.

## 2. Fill the invariants from evidence

An invariant is a rule that, when broken, doesn't fail loudly — it ships
broken. Look for them before asking:

- `git log --oneline -n 200 | grep -iE "fix|revert|hotfix|regression"` — each
  fix that says *why* something broke is a candidate.
- Comments containing `NEVER`, `MUST`, `don't`, `do not`, `careful`, `HACK`,
  `workaround`.
- Anything the draft's "Starting points from the stack" list flags.
- Generated directories (`_generated/`, `prisma/client`, `*.gen.ts`) — agents
  hand-edit these.

Write each as a short paragraph: **the rule** in bold, what happened when it
was broken, where it lives. Then show the user the list and ask what's missing:
"What's the last bug that reached production that a new contributor would
have caused?" Their answer is usually the most valuable line in the file.

## 3. Fill "Where things go"

The three to six changes made most often, each as one table row: the need and
the exact file(s). Derive from `git log --stat` — the paths that change
together most often are the answer.

## 4. Trim

Delete every `TODO` you couldn't fill and every line that is true of all
projects ("write clean code"). If it's over ~150 lines, cut the layout table
first; agents can `ls`.

## 5. Report

Show the final file and list the invariants you inferred so the user can
correct them. Offer `--agents` (writes an `AGENTS.md` pointer) for repos also
used with Cursor, Codex or Copilot.
