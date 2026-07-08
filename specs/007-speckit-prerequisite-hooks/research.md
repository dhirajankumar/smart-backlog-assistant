# Research: Speckit Prerequisite Guardrail Hooks

**Feature**: 007-speckit-prerequisite-hooks | **Date**: 2026-07-07

---

## Decision 1: Hook Execution Model — How Mandatory Hooks Signal Failure

**Decision**: Mandatory hooks signal failure through text output. The calling skill (speckit-tasks or speckit-implement) reads the hook skill's output; if it contains an ERROR marker, the skill halts and reports to the user. There is no exit-code-based hard stop — the Claude model interprets hook output and decides whether to continue.

**Rationale**: This is the existing hook execution model as defined in speckit-tasks and speckit-implement SKILL.md files. The skills say: "After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing." The hook output becomes input to the parent skill's reasoning. An ERROR-prefixed message reliably signals that the parent must halt.

**Alternatives considered**:
- Hard process exit codes: Not applicable — Claude skills are prompt-driven, not subprocess-based. The skill runtime does not enforce exit codes across skill invocations.
- Separate "abort" response format: Considered a special `ABORT:` or `HALT:` token in hook output. Rejected because the existing `ERROR:` pattern is already established in `check-prerequisites.sh` and `setup-tasks.sh`.

---

## Decision 2: One Hook Skill or Two

**Decision**: Two separate skills — `speckit-check-prerequisites` (for before_tasks, checks spec + plan) and `speckit-check-prerequisites-implement` (for before_implement, checks spec + plan + tasks).

**Rationale**: The hook command name maps directly to the skill name (dot-notation → hyphen-notation). The `before_tasks` hook runs `speckit.check-prerequisites` → `/speckit-check-prerequisites`. The `before_implement` hook runs `speckit.check-prerequisites-implement` → `/speckit-check-prerequisites-implement`. Since the hook system has no mechanism to pass arguments to skills, two skills with different responsibilities are the cleanest split.

**Alternatives considered**:
- One skill that detects its context: Rejected. A skill has no reliable way to detect whether it was invoked as a `before_tasks` or `before_implement` hook — there is no context injection in the hook invocation.
- One skill that checks all three (spec + plan + tasks): Rejected for `before_tasks` — at that point tasks.md does not yet exist (that's what the command creates), so checking for it would always fail.

---

## Decision 3: Where Validation Logic Lives — Script vs. Skill Text

**Decision**: Validation logic lives in `check-prerequisites.sh` (enhanced with `--require-spec` flag). Hook skills invoke the script and report its output. Skills do not duplicate validation logic.

**Rationale**: `check-prerequisites.sh` is the authoritative validation script. It handles path resolution via `common.sh`, Windows python3 workarounds (SPECIFY_FEATURE_DIRECTORY env var), and consistent error messaging. Centralizing logic in the script means a single fix propagates to all consumers.

**Alternatives considered**:
- Pure skill-text validation (no script): The skill SKILL.md could include instructions like "check if spec.md exists by reading the file". Rejected because this duplicates logic that check-prerequisites.sh already does correctly, and any future path resolution improvements would need to be made in two places.
- New standalone validation script: Rejected — check-prerequisites.sh already has the right structure; adding a flag is less disruptive than a new script.

---

## Decision 4: Adding `--require-spec` to check-prerequisites.sh

**Decision**: Add a `--require-spec` flag to `check-prerequisites.sh` that checks for `spec.md` (`$FEATURE_SPEC`) in addition to its existing checks.

**Rationale**: Currently, `check-prerequisites.sh` checks for `plan.md` (always) and `tasks.md` (with `--require-tasks`) but does NOT check for `spec.md`. The implement path uses this script and therefore has a gap — it validates plan and tasks but not spec. Adding `--require-spec` closes this gap with minimal code change.

**Note**: `setup-tasks.sh` already checks both spec.md and plan.md (lines 31-41). The hook for `before_tasks` therefore provides an *earlier* validation point, not a new capability.

---

## Decision 5: extensions.yml Schema

**Decision**: Use the schema already expected by speckit-tasks and speckit-implement SKILL.md files:
```yaml
hooks:
  before_tasks:
    - extension: "..."
      command: "speckit.check-prerequisites"
      description: "..."
      optional: false
      enabled: true
  before_implement:
    - extension: "..."
      command: "speckit.check-prerequisites-implement"
      description: "..."
      optional: false
      enabled: true
```

**Rationale**: The skills already implement YAML parsing for this exact schema. No schema changes are needed — we are providing a file that the existing hook-reading code already handles.

**Alternatives considered**: None. The schema is fixed by existing skill implementations.

---

## Decision 6: Mandatory vs. Optional Default

**Decision**: Both hooks default to `optional: false` (mandatory), blocking execution when prerequisites are missing.

**Rationale**: The purpose of a guardrail is to prevent errors. An optional hook that merely warns does not prevent the user from running into a worse failure later. Teams that need to bypass the check can set `optional: true` in their `extensions.yml`.

**Alternatives considered**:
- Default optional: Rejected. A warning-only guardrail does not prevent the problem it was designed to catch.
- No configuration at all: Rejected (covered by FR-006). Teams with legitimate bypass needs should not have to modify skill code.

---

## Known Environment Constraint: Windows python3 Alias

The `common.sh` `read_feature_json_feature_directory()` function falls through to grep/sed when jq and python3 are unavailable. However, on Windows machines with the python3 App Execution Alias enabled, `command -v python3` returns success but the process exits 49 (Microsoft Store stub). This causes the function to return empty and fail feature-path resolution.

**Workaround** (already discovered): Set `SPECIFY_FEATURE_DIRECTORY` environment variable explicitly, or run with the env var prefix: `SPECIFY_FEATURE_DIRECTORY=specs/007-... bash ...`.

**Impact on hook skills**: Hook skills invoke `check-prerequisites.sh` via bash. They must either document this workaround or use `SPECIFY_FEATURE_DIRECTORY` if the env var is available from the parent skill's context. This does not block implementation — it is an existing known issue.
