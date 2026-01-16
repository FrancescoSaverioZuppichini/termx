---
name: create-subagent
description: Use when creating custom Claude Code subagents - guides YAML frontmatter structure, system prompts, tool restrictions, model selection, and permission configuration
---

# Create Custom Subagents

Subagents are specialized AI assistants that run in isolated contexts with custom prompts, specific tool access, and independent permissions.

## File Location

```bash
.claude/agents/name.md   # Project scope (shared via git)
~/.claude/agents/name.md # User scope (all your projects)
```

## Required Structure

```markdown
---
name: kebab-case-name
description: When Claude should delegate to this subagent
---

System prompt goes here. This is the ONLY prompt the subagent receives.
```

## Frontmatter Fields

| Field | Required | Values |
|-------|----------|--------|
| `name` | Yes | Lowercase + hyphens only |
| `description` | Yes | When to use (Claude reads this to decide delegation) |
| `tools` | No | Allowlist: `Read, Grep, Glob, Bash, Edit, Write, WebFetch, WebSearch, LSP, Task, NotebookEdit` |
| `disallowedTools` | No | Denylist (removed from inherited tools) |
| `model` | No | `haiku`, `sonnet`, `opus`, or `inherit` (default: `sonnet`) |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | No | Skills to inject at startup |
| `hooks` | No | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |

## Tool Restriction Examples

```yaml
# Read-only agent
tools: Read, Grep, Glob

# Full access minus file writes
disallowedTools: Write, Edit

# Only bash + file reading
tools: Bash, Read
```

## Model Selection

- `haiku` - Fast, cheap. Good for simple lookups.
- `sonnet` - Balanced (default). Good for most tasks.
- `opus` - Most capable. Complex reasoning.
- `inherit` - Match parent conversation.

## Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Standard prompts |
| `acceptEdits` | Auto-accept file edits |
| `dontAsk` | Auto-deny prompts (allowed tools still work) |
| `bypassPermissions` | Skip ALL permission checks (dangerous) |
| `plan` | Read-only exploration |

## Hooks in Frontmatter

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint.sh"
```

## Example: Code Reviewer (Read-Only)

```markdown
---
name: code-reviewer
description: Expert code reviewer. Use proactively after code changes.
tools: Read, Grep, Glob, Bash
model: inherit
---

You are a senior code reviewer.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review for:
- Clarity and readability
- Proper error handling
- Security issues (exposed secrets, injection)
- Test coverage

Output by priority:
- Critical (must fix)
- Warnings (should fix)
- Suggestions (nice to have)
```

## Example: Debugger (Full Access)

```markdown
---
name: debugger
description: Debug errors, test failures, unexpected behavior. Use when shit breaks.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger.

Process:
1. Capture error + stack trace
2. Identify repro steps
3. Find root cause
4. Implement minimal fix
5. Verify fix works

Focus on the underlying issue, not symptoms.
```

## Example: DB Reader with Validation Script

A subagent that only allows read-only database queries, validated by a custom script.

**Directory structure:**
```
.claude/
├── agents/
│   └── db-reader.md
└── scripts/
    └── validate-readonly-query.sh
```

**`.claude/agents/db-reader.md`:**
```markdown
---
name: db-reader
description: Execute read-only database queries. Use for data analysis and reporting.
tools: Bash
model: haiku
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: ".claude/scripts/validate-readonly-query.sh"
---

You are a database query specialist. Only SELECT queries allowed.

When invoked:
1. Understand what data the user needs
2. Write efficient SQL query
3. Execute via psql/mysql/bq command
4. Summarize results clearly

Always use LIMIT to prevent massive result sets.
```

**`.claude/scripts/validate-readonly-query.sh`:**
```bash
#!/bin/bash

INPUT="$TOOL_INPUT"

if echo "$INPUT" | grep -iE "(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)" > /dev/null; then
  echo "BLOCKED: Write operations not allowed"
  exit 1
fi

exit 0
```

The hook receives `$TOOL_INPUT` with the command being executed. Exit code 0 = allow, non-zero = block.

## Writing Effective Descriptions

Claude uses the description to decide when to delegate. Be specific.

```yaml
# Good - clear trigger
description: Reviews code for quality and security. Use after code changes.

# Good - proactive hint
description: Test runner. Use proactively after implementing features.

# Bad - vague
description: Helps with code stuff
```

## Quick Checklist

- [ ] File in `.claude/agents/` or `~/.claude/agents/`
- [ ] `name` is kebab-case
- [ ] `description` tells Claude WHEN to use it
- [ ] `tools` restricted to what's actually needed
- [ ] System prompt is focused and actionable
- [ ] Tested: "Use the X subagent to..."
