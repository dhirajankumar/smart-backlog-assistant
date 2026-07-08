# Feature Specification: Speckit Prerequisite Guardrail Hooks

**Feature Branch**: `007-speckit-prerequisite-hooks`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Add Hooks to add guardrail on /speckit-task or /speckit-implement, that Hook should run to find and verify related plan and feature spec is present or not, if not prompt the user to implement those first."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Blocked from Tasks Without Spec or Plan (Priority: P1)

A developer runs `/speckit-tasks` against a feature directory that has no `spec.md` or no `plan.md`.
Instead of watching the skill begin and fail mid-way (or silently produce bad output), they immediately
see a clear error message explaining which artifact is missing and exactly which command to run to
fix it — before any task generation begins.

**Why this priority**: This is the primary guardrail. Running speckit-tasks without a spec or plan
produces meaningless tasks. Failing fast with actionable guidance is the highest-value UX fix.

**Independent Test**: Run `/speckit-tasks` in a feature directory that has no `spec.md`. The hook
must fire, output an error naming the missing file and the corrective command, and prevent
task generation from starting.

**Acceptance Scenarios**:

1. **Given** a feature directory with no `spec.md`, **When** the developer runs `/speckit-tasks`, **Then** the `before_tasks` hook fires first, outputs "ERROR: spec.md not found — run /speckit-specify first", and the skill halts before generating any tasks.
2. **Given** a feature directory with `spec.md` but no `plan.md`, **When** the developer runs `/speckit-tasks`, **Then** the hook fires, outputs "ERROR: plan.md not found — run /speckit-plan first", and the skill halts.
3. **Given** a feature directory with both `spec.md` and `plan.md`, **When** the developer runs `/speckit-tasks`, **Then** the hook passes silently and task generation proceeds normally.

---

### User Story 2 — Blocked from Implement Without All Three Artifacts (Priority: P1)

A developer runs `/speckit-implement` against a feature directory missing one or more of `spec.md`,
`plan.md`, or `tasks.md`. They receive an immediate, specific error identifying which artifact is
missing and the exact command needed to create it — no partial execution occurs.

**Why this priority**: Implementing without a plan or tasks list produces unstructured, un-reviewed
work that violates the constitution's Human Oversight and Scope Integrity principles.

**Independent Test**: Run `/speckit-implement` in a feature directory that has `spec.md` + `plan.md`
but no `tasks.md`. The `before_implement` hook fires, outputs an error naming `tasks.md` as missing
and instructs the developer to run `/speckit-tasks` first.

**Acceptance Scenarios**:

1. **Given** a feature directory with no `spec.md`, **When** the developer runs `/speckit-implement`, **Then** the hook fires and halts with "ERROR: spec.md not found — run /speckit-specify first".
2. **Given** a feature directory with `spec.md` + `plan.md` but no `tasks.md`, **When** the developer runs `/speckit-implement`, **Then** the hook fires and halts with "ERROR: tasks.md not found — run /speckit-tasks first".
3. **Given** a feature directory with `spec.md`, `plan.md`, and `tasks.md`, **When** the developer runs `/speckit-implement`, **Then** the hook passes silently and implementation proceeds normally.

---

### User Story 3 — Hooks Configurable Per Project (Priority: P2)

A project maintainer can enable, disable, or make optional any guardrail hook by editing
`.specify/extensions.yml` without modifying any skill file. Disabling a hook causes the guarded
command to run without prerequisite validation.

**Why this priority**: Teams may have legitimate reasons to skip validation (e.g., brownfield
migrations, partial workflows). The hook system must be configurable without forking skill code.

**Independent Test**: Set `enabled: false` on the `before_tasks` hook in `extensions.yml`, then
run `/speckit-tasks` without `spec.md` present. The command should proceed without the hook firing.

**Acceptance Scenarios**:

1. **Given** a hook with `enabled: false` in `extensions.yml`, **When** the guarded command runs, **Then** the hook is skipped and the command executes without any prerequisite check.
2. **Given** a hook with `optional: true` in `extensions.yml`, **When** the prerequisite is missing, **Then** the hook outputs a warning (not an error) and prompts the user to continue or abort rather than blocking automatically.

---

### Edge Cases

- What if `.specify/feature.json` is missing or malformed? → Hook reports "No active feature found — run /speckit-specify to set up a feature context" and halts.
- What if the feature directory is set but the directory itself does not exist? → Hook reports the directory name and instructs the user to run `/speckit-specify`.
- What if `extensions.yml` is malformed YAML? → Both guarded skills skip hook execution silently (existing behavior per skill spec) and proceed normally.
- What if neither `spec.md` nor `plan.md` is present? → The hook reports the first missing artifact (spec) and halts; the developer fixes one at a time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST register a mandatory `before_tasks` hook in `.specify/extensions.yml` that runs before `/speckit-tasks` executes.
- **FR-002**: The `before_tasks` hook MUST verify that `spec.md` exists in the active feature directory; if absent, it MUST output an actionable error and halt task generation.
- **FR-003**: The `before_tasks` hook MUST verify that `plan.md` exists in the active feature directory; if absent, it MUST output an actionable error and halt task generation.
- **FR-004**: The system MUST register a mandatory `before_implement` hook in `.specify/extensions.yml` that runs before `/speckit-implement` executes.
- **FR-005**: The `before_implement` hook MUST verify that `spec.md`, `plan.md`, and `tasks.md` all exist in the active feature directory; for each missing file, it MUST output an actionable error naming the missing file and the command to create it.
- **FR-006**: Each hook MUST be individually configurable via `extensions.yml` (`enabled: true/false`, `optional: true/false`) without requiring skill file edits.
- **FR-007**: Hook skills MUST output their results using `check-prerequisites.sh` (enhanced to support `--require-spec` flag) to avoid duplicating validation logic.
- **FR-008**: `check-prerequisites.sh` MUST be extended with a `--require-spec` flag that adds `spec.md` existence to its validation checks.
- **FR-009**: All error messages MUST name the specific missing file and the exact slash command needed to create it.

### Key Entities

- **extensions.yml**: YAML configuration file at `.specify/extensions.yml`. Defines hooks keyed by lifecycle event (`before_tasks`, `before_implement`). Each hook entry includes `extension`, `command`, `description`, `optional`, and `enabled` fields.
- **Hook Skill**: A Claude Code skill invoked by the hook system. For prerequisites, two skills: `speckit-check-prerequisites` (for tasks) and `speckit-check-prerequisites-implement` (for implement).
- **check-prerequisites.sh**: Bash script at `.specify/scripts/bash/check-prerequisites.sh`. Extended with `--require-spec` flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `/speckit-tasks` in a directory missing `spec.md` produces a clear error within the first hook execution, before any tasks are generated.
- **SC-002**: Running `/speckit-implement` in a directory missing `tasks.md` produces a clear error within the first hook execution, before any implementation steps execute.
- **SC-003**: Setting `enabled: false` on a hook in `extensions.yml` results in the guarded command running without prerequisite validation.
- **SC-004**: All error messages reference both the missing file name and the corrective slash command (e.g., "/speckit-specify", "/speckit-plan", "/speckit-tasks").
- **SC-005**: No existing speckit workflow is broken — projects that already have all artifacts pass all hooks without any visible change in behavior.

## Assumptions

- The hook system (reading `hooks.before_tasks` and `hooks.before_implement` from `extensions.yml`) is already implemented in the `speckit-tasks` and `speckit-implement` skills (confirmed by reading their SKILL.md files).
- The `check-prerequisites.sh` script is the authoritative prerequisite checker; logic must not be duplicated in hook skills.
- Hook skills are non-interactive — they run, output text, and exit. The calling skill reads the output and decides whether to continue.
- The Windows python3 App Execution Alias bug (which affects `feature.json` parsing via `command -v python3`) is a known environmental issue; hook scripts must not rely on python3.
- `spec.md` checking for the tasks path is already handled in `setup-tasks.sh`; the hook provides an earlier, more visible failure point.
