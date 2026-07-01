# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Smart Backlog Assistant** is a Spec-Kit (v0.12.2) project — a specification-driven development (SDD) framework that orchestrates feature work through four phases: Specify → Plan → Tasks → Implement. There is no traditional application code, build system, or test runner. The "code" is a set of Claude Code skills (prompts + scripts) that guide structured feature development.

## Workflow Commands

All work starts from a natural language feature description and proceeds through slash commands:

| Command | Purpose |
|---|---|
| `/speckit-specify "description"` | Create or update `specs/NNN-feature-name/spec.md` |
| `/speckit-clarify` | Resolve ambiguities before planning (asks up to 5 targeted questions) |
| `/speckit-plan` | Generate `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| `/speckit-tasks` | Generate dependency-ordered `tasks.md` |
| `/speckit-implement` | Execute tasks from `tasks.md` |
| `/speckit-converge` | Detect gaps post-implementation; appends remaining work to `tasks.md` |
| `/speckit-analyze` | Read-only cross-artifact consistency check (spec ↔ plan ↔ tasks) |
| `/speckit-checklist` | Domain-specific quality validation of requirements |
| `/speckit-constitution` | Manage project-level principles and governance rules |
| `/speckit-taskstoissues` | Convert `tasks.md` entries into GitHub issues |

Feature directories are numbered sequentially: `specs/001-feature-name/`, `specs/002-next-feature/`, etc.

## Architecture

### Spec-Kit Framework Layout

```
.claude/skills/          # Skill definitions (SKILL.md per command)
.specify/
  templates/             # spec, plan, tasks, checklist, constitution templates
  scripts/bash/          # Shared shell utilities (common.sh, check-prerequisites.sh, etc.)
  workflows/speckit/     # workflow.yml orchestrating full lifecycle
  integrations/          # claude.manifest.json, speckit.manifest.json
  memory/constitution.md # Project principles and governance (currently template)
```

### Four-Phase Lifecycle

1. **Specify** — Converts natural language into user stories with acceptance criteria. Output: `spec.md`.
2. **Plan** — Defines technical architecture, dependencies, data models, and API contracts. Output: multiple design artifacts in the feature directory. Constitution compliance is checked here.
3. **Tasks** — Produces a dependency-ordered, story-organized `tasks.md`. Tasks marked `[P]` can run in parallel.
4. **Implement** — Executes tasks, tracks progress via checklists, runs `/speckit-converge` afterward to catch gaps.

### Key Design Constraints

- Each user story in a spec must be independently testable as an MVP — tasks are organized per story to enable incremental deployment.
- The **constitution** (`/.specify/memory/constitution.md`) defines non-negotiable project principles. Violations flagged during `/speckit-analyze` or `/speckit-plan` are CRITICAL and block progress until resolved.
- Analysis results are capped at 50 findings; large artifact sets use progressive loading to stay token-efficient.

### Hook System

Skills support before/after hooks defined in `.specify/extensions.yml`. Hook commands use dot-notation (`speckit.git.commit`) which maps to slash commands (`/speckit-git-commit`). Conditions on hooks are evaluated by HookExecutor, not inline.

### Scripts

`.specify/scripts/bash/common.sh` provides shared utilities used across skills: repo root detection, feature state resolution, and branch management. `check-prerequisites.sh` emits JSON-formatted prerequisite validation results consumed by skills before execution.

### Claude Integration

Integration config: `.specify/integration.json` — uses `claude` as the AI backend with `invoke_separator: "-"` and `script: "sh"`. Skills in `.claude/skills/` are AI-executable prompts; `ai_skills: true` enables autonomous skill chaining.
