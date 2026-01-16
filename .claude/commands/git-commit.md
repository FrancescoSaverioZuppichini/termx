---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
model: claude-3-5-haiku-20241022
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

1. Analyze the staged changes above
2. Write a concise commit message following conventional commits (feat:, fix:, etc.)
3. **Run `git commit -m "..."` using the Bash tool** - do NOT just describe what to do

If nothing is staged, stage relevant files first with `git add`.