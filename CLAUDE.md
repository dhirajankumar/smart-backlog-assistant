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

### Project Structure

```
/
├── CLAUDE.md                           ← project instructions (this file)
├── .specify/
│   └── memory/
│       └── constitution.md             ← architectural DNA; READ before every spec
├── .claude/
│   ├── settings.json                   ← hooks and permissions
│   └── skills/                         ← skill definitions (SKILL.md per command)
├── specs/                              ← one folder per feature/phase (Spec-Kit output)
│   ├── phase-1-discovery/
│   │   └── spec.md
│   ├── phase-2-architecture/
│   │   └── spec.md
│   └── NNN-feature-name/               ← numbered sequentially for standalone features
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       └── ...
├── docs/
│   ├── spec/                           ← SDLC phase documents (human-readable narrative)
│   │   ├── 00-constitution.md              ← project source of truth; updated on every phase change
│   │   ├── 01-discovery.md
│   │   ├── 02-architecture.md
│   │   ├── 03-prototype.md
│   │   ├── 04-build.md
│   │   ├── 05-testing.md
│   │   └── 06-release.md
│   ├── decisions/                      ← Architecture Decision Records (ADRs)
│   │   ├── ADR-001-model-choice.md
│   │   ├── ADR-002-integration.md
│   │   ├── ADR-003-data-residency.md
│   │   └── ADR-004-auth.md
│   └── prompts/                        ← prompt engineering artifacts
│       ├── system-prompt-v1.md
│       └── evaluation-cases.md
├── src/                                ← application source code
├── tests/                              ← test suites
├── .specify/
│   ├── templates/                      ← spec, plan, tasks, checklist, constitution templates
│   ├── scripts/bash/                   ← shared shell utilities
│   ├── workflows/speckit/              ← workflow.yml orchestrating full lifecycle
│   └── integrations/                   ← claude.manifest.json, speckit.manifest.json
└── .github/
    └── workflows/                      ← CI/CD pipelines
```

### Doc Sync Rules

These rules are **mandatory**. Apply them automatically — do not wait to be asked.

| Trigger | Required action |
|---|---|
| Creating or updating any file under `specs/` | Update `docs/spec/00-constitution.md` to reflect the change; update the relevant SDLC phase doc (`01`–`06`) if the content maps to a phase |
| Making or confirming an architectural decision during `/speckit-plan` | Create or update an ADR in `docs/decisions/ADR-NNN-<decision>.md` |
| Writing or materially changing a prompt in any spec or plan | Reflect it in `docs/prompts/` |
| Running `/speckit-constitution` | No doc update required; constitution is self-contained |
| Running `/speckit-implement` | After completion, verify `docs/spec/00-constitution.md` still accurately reflects project state |

**`docs/spec/00-constitution.md` is the single source of truth for project status.** It MUST stay current. If it does not exist yet, create it when you first touch `docs/`.

**ADR naming**: `ADR-NNN-<kebab-case-decision-topic>.md`. Increment NNN from the highest existing ADR. Minimum ADR sections: `# ADR-NNN Title`, `## Status`, `## Context`, `## Decision`, `## Consequences`.

### Four-Phase Lifecycle

1. **Specify** — Converts natural language into user stories with acceptance criteria. Output: `spec.md`.
2. **Plan** — Defines technical architecture, dependencies, data models, and API contracts. Output: multiple design artifacts in the feature directory. Constitution compliance is checked here.
3. **Tasks** — Produces a dependency-ordered, story-organized `tasks.md`. Tasks marked `[P]` can run in parallel.
4. **Implement** — Executes tasks, tracks progress via checklists, runs `/speckit-converge` afterward to catch gaps.

### Key Design Constraints

- Each user story in a spec must be independently testable as an MVP — tasks are organized per story to enable incremental deployment.
- The **constitution** (`.specify/memory/constitution.md`) defines non-negotiable project principles. Read it before writing any spec. Violations flagged during `/speckit-analyze` or `/speckit-plan` are CRITICAL and block progress until resolved.
- Analysis results are capped at 50 findings; large artifact sets use progressive loading to stay token-efficient.

### Hook System

Skills support before/after hooks defined in `.specify/extensions.yml`. Hook commands use dot-notation (`speckit.git.commit`) which maps to slash commands (`/speckit-git-commit`). Conditions on hooks are evaluated by HookExecutor, not inline.

### Scripts

`.specify/scripts/bash/common.sh` provides shared utilities used across skills: repo root detection, feature state resolution, and branch management. `check-prerequisites.sh` emits JSON-formatted prerequisite validation results consumed by skills before execution.

### Claude Integration

Integration config: `.specify/integration.json` — uses `claude` as the AI backend with `invoke_separator: "-"` and `script: "sh"`. Skills in `.claude/skills/` are AI-executable prompts; `ai_skills: true` enables autonomous skill chaining.
