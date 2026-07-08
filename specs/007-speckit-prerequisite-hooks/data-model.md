# Data Model: Speckit Prerequisite Guardrail Hooks

**Feature**: 007-speckit-prerequisite-hooks | **Date**: 2026-07-07

---

## Configuration Entity: extensions.yml

**Location**: `.specify/extensions.yml` (project root)

**Purpose**: Declares extension hooks keyed by lifecycle event. The speckit-tasks and speckit-implement skills read this file at startup to discover and invoke hooks.

**Schema**:

```yaml
hooks:
  <event-name>:                   # e.g., before_tasks, before_implement
    - extension: string           # Human-readable name for logging
      command: string             # Dot-notation command → maps to /skill-name (dots → hyphens)
      description: string         # Short description of what the hook does
      optional: boolean           # false = mandatory (blocks on error), true = advisory (warns only)
      enabled: boolean            # false = hook is skipped entirely
      condition: string | null    # Optional condition expression (evaluated by HookExecutor; skip if non-empty)
```

**Validation rules**:
- `command` must follow dot-notation (e.g., `speckit.check-prerequisites`)
- `optional` and `enabled` default to `true` when omitted
- `condition` expressions are NOT evaluated by the skills themselves — they are passed to HookExecutor; skills treat non-empty conditions as skip
- Multiple hooks per event are supported (processed in array order)

**Canonical file for this feature**:

```yaml
hooks:
  before_tasks:
    - extension: "Prerequisite Guardrail"
      command: "speckit.check-prerequisites"
      description: "Verify spec.md and plan.md exist before generating tasks"
      optional: false
      enabled: true

  before_implement:
    - extension: "Prerequisite Guardrail"
      command: "speckit.check-prerequisites-implement"
      description: "Verify spec.md, plan.md, and tasks.md exist before implementing"
      optional: false
      enabled: true
```

---

## Script Entity: check-prerequisites.sh (enhanced)

**Location**: `.specify/scripts/bash/check-prerequisites.sh`

**New flag**: `--require-spec`

**Updated CLI flags**:

| Flag | Validates |
|------|-----------|
| (default) | `plan.md` |
| `--require-spec` | `spec.md` + `plan.md` |
| `--require-tasks` | `plan.md` + `tasks.md` |
| `--require-spec --require-tasks` | `spec.md` + `plan.md` + `tasks.md` |
| `--include-tasks` | Adds `tasks.md` to AVAILABLE_DOCS list |
| `--paths-only` | No validation; returns path variables only |

**Check order** (when flags combine):
1. Feature directory existence
2. `spec.md` (if `--require-spec`)
3. `plan.md` (always, unless `--paths-only`)
4. `tasks.md` (if `--require-tasks`)

**Error output format** (to stderr):
```
ERROR: spec.md not found in /path/to/feature-dir
Run /speckit-specify first to create the feature specification.
```

**JSON output format** (unchanged when checks pass):
```json
{"FEATURE_DIR": "/abs/path/to/feature", "AVAILABLE_DOCS": ["research.md", "data-model.md"]}
```

---

## Skill Entity: speckit-check-prerequisites

**Location**: `.claude/skills/speckit-check-prerequisites/SKILL.md`

**Invoked by**: `before_tasks` hook (command: `speckit.check-prerequisites`)

**Purpose**: Validate that `spec.md` and `plan.md` exist for the active feature before task generation begins.

**Execution**: Runs `check-prerequisites.sh --require-spec` (validates spec + plan). Reports pass or error to the parent skill.

**Output on pass**:
```
✓ Prerequisites check passed: spec.md and plan.md found.
Proceeding with task generation.
```

**Output on failure** (example):
```
ERROR: spec.md not found in specs/007-speckit-prerequisite-hooks
Run /speckit-specify first to create the feature specification.
HALT: Task generation cannot proceed until the missing prerequisite is resolved.
```

---

## Skill Entity: speckit-check-prerequisites-implement

**Location**: `.claude/skills/speckit-check-prerequisites-implement/SKILL.md`

**Invoked by**: `before_implement` hook (command: `speckit.check-prerequisites-implement`)

**Purpose**: Validate that `spec.md`, `plan.md`, and `tasks.md` all exist for the active feature before implementation begins.

**Execution**: Runs `check-prerequisites.sh --require-spec --require-tasks` (validates spec + plan + tasks).

**Output on pass**:
```
✓ Prerequisites check passed: spec.md, plan.md, and tasks.md found.
Proceeding with implementation.
```

**Output on failure** (example, tasks.md missing):
```
ERROR: tasks.md not found in specs/007-speckit-prerequisite-hooks
Run /speckit-tasks first to create the task list.
HALT: Implementation cannot proceed until the missing prerequisite is resolved.
```

---

## State Transitions

```
Feature Directory State           Hook Behavior
────────────────────────────────────────────────────────────────
No spec.md                    →   before_tasks: ERROR (spec missing)
spec.md only                  →   before_tasks: ERROR (plan missing)
spec.md + plan.md             →   before_tasks: PASS ✓
                                  before_implement: ERROR (tasks missing)
spec.md + plan.md + tasks.md  →   before_tasks: PASS ✓
                                  before_implement: PASS ✓
```
