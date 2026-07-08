# Quickstart Validation Guide: Speckit Prerequisite Guardrail Hooks

**Feature**: 007-speckit-prerequisite-hooks | **Date**: 2026-07-07

---

## Prerequisites

- Spec-Kit project with `.specify/` directory
- Feature 007 implementation complete (all three deliverables in place)
- An active feature set in `.specify/feature.json` or via `SPECIFY_FEATURE_DIRECTORY` env var

---

## Scenario 1: Verify before_tasks Hook — Missing spec.md

**Setup**: Use a test feature directory with no `spec.md`:
```bash
mkdir -p specs/test-hook-validation
echo '{"feature_directory":"specs/test-hook-validation"}' > .specify/feature.json
```

**Run**: `/speckit-tasks`

**Expected outcome**:
1. The skill reads `extensions.yml` and finds the mandatory `before_tasks` hook
2. The hook (`/speckit-check-prerequisites`) fires before any task generation
3. Output contains:
   ```
   ERROR: spec.md not found in specs/test-hook-validation
   Run /speckit-specify first to create the feature specification.
   HALT: Task generation cannot proceed until the missing prerequisite is resolved.
   ```
4. No `tasks.md` is created

**Pass criteria**: `tasks.md` does NOT exist in the test directory; error output matches the pattern above.

---

## Scenario 2: Verify before_tasks Hook — Missing plan.md (spec.md present)

**Setup**:
```bash
touch specs/test-hook-validation/spec.md
```

**Run**: `/speckit-tasks`

**Expected outcome**:
```
ERROR: plan.md not found in specs/test-hook-validation
Run /speckit-plan first to create the implementation plan.
HALT: Task generation cannot proceed until the missing prerequisite is resolved.
```

**Pass criteria**: `tasks.md` does NOT exist; error names `plan.md` and `/speckit-plan`.

---

## Scenario 3: Verify before_tasks Hook — All Prerequisites Present

**Setup**:
```bash
touch specs/test-hook-validation/plan.md
```

**Run**: `/speckit-tasks`

**Expected outcome**:
```
✓ Prerequisites check passed: spec.md and plan.md found.
Proceeding with task generation.
```
Task generation then runs normally.

---

## Scenario 4: Verify before_implement Hook — Missing tasks.md

**Setup**: Use a directory with spec.md + plan.md but no tasks.md:
```bash
# spec.md and plan.md already exist from Scenario 3
rm -f specs/test-hook-validation/tasks.md
```

**Run**: `/speckit-implement`

**Expected outcome**:
```
ERROR: tasks.md not found in specs/test-hook-validation
Run /speckit-tasks first to create the task list.
HALT: Implementation cannot proceed until the missing prerequisite is resolved.
```

**Pass criteria**: Implementation does NOT begin; error names `tasks.md` and `/speckit-tasks`.

---

## Scenario 5: Verify Hook Can Be Disabled

**Setup**: Edit `.specify/extensions.yml` and set `enabled: false` on the `before_tasks` hook:
```yaml
hooks:
  before_tasks:
    - extension: "Prerequisite Guardrail"
      command: "speckit.check-prerequisites"
      description: "Verify spec.md and plan.md exist before generating tasks"
      optional: false
      enabled: false    # ← disabled
```

Remove `spec.md` from the test directory:
```bash
rm specs/test-hook-validation/spec.md
```

**Run**: `/speckit-tasks`

**Expected outcome**: Task generation proceeds without the prerequisite check firing.

**Pass criteria**: The `before_tasks` hook is NOT invoked; `/speckit-tasks` runs its normal setup flow.

---

## Cleanup

```bash
rm -rf specs/test-hook-validation
echo '{"feature_directory":"specs/007-speckit-prerequisite-hooks"}' > .specify/feature.json
```

---

## Verifying check-prerequisites.sh --require-spec (unit validation)

Run directly to verify the script change:
```bash
# Should fail: no spec.md
mkdir -p /tmp/speckit-test
SPECIFY_FEATURE_DIRECTORY=/tmp/speckit-test bash .specify/scripts/bash/check-prerequisites.sh --require-spec 2>&1
# Expected: ERROR about spec.md missing

# Should fail: no plan.md
touch /tmp/speckit-test/spec.md
SPECIFY_FEATURE_DIRECTORY=/tmp/speckit-test bash .specify/scripts/bash/check-prerequisites.sh --require-spec 2>&1
# Expected: ERROR about plan.md missing

# Should pass
touch /tmp/speckit-test/plan.md
SPECIFY_FEATURE_DIRECTORY=/tmp/speckit-test bash .specify/scripts/bash/check-prerequisites.sh --require-spec 2>&1
# Expected: JSON output with FEATURE_DIR and AVAILABLE_DOCS

rm -rf /tmp/speckit-test
```
