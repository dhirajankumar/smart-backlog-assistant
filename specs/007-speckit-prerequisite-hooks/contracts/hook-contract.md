# Hook Skill Contract

**Feature**: 007-speckit-prerequisite-hooks | **Date**: 2026-07-07

---

## Contract: speckit-check-prerequisites (before_tasks hook)

**Invocation**: Registered as mandatory hook under `hooks.before_tasks` in `.specify/extensions.yml`.
Called by the speckit-tasks skill as: `/speckit-check-prerequisites`.

### Preconditions

- `.specify/feature.json` exists and contains a valid `feature_directory` value, OR `SPECIFY_FEATURE_DIRECTORY` env var is set.
- The hook skill has access to `.specify/scripts/bash/check-prerequisites.sh`.

### Execution Contract

The skill MUST invoke:
```bash
SPECIFY_FEATURE_DIRECTORY="<feature_dir>" bash .specify/scripts/bash/check-prerequisites.sh --require-spec
```

where `<feature_dir>` is the relative path to the active feature directory.

### Output Contract

**On success** (spec.md and plan.md both exist):
- Stdout: Contains `✓ Prerequisites check passed` (or similar success indicator)
- No `ERROR:` prefix in output
- No `HALT:` token in output

**On failure** (spec.md or plan.md missing):
- Stdout: Contains `ERROR:` prefix followed by the missing file name and feature directory path
- Stdout: Contains the corrective slash command (e.g., `Run /speckit-specify first`)
- Stdout: Contains `HALT:` token to signal the parent skill to stop

### Parent Skill Response Contract

When the calling skill (speckit-tasks) invokes this hook:
- If output contains `HALT:` → halt immediately, report the error message to the user, do not proceed with task generation
- If output contains `ERROR:` but no `HALT:` → treat as advisory warning; log and continue
- If output contains neither → proceed with task generation normally

---

## Contract: speckit-check-prerequisites-implement (before_implement hook)

**Invocation**: Registered as mandatory hook under `hooks.before_implement` in `.specify/extensions.yml`.
Called by the speckit-implement skill as: `/speckit-check-prerequisites-implement`.

### Preconditions

Same as above.

### Execution Contract

The skill MUST invoke:
```bash
SPECIFY_FEATURE_DIRECTORY="<feature_dir>" bash .specify/scripts/bash/check-prerequisites.sh --require-spec --require-tasks
```

### Output Contract

**On success** (spec.md, plan.md, and tasks.md all exist):
- Stdout: Contains `✓ Prerequisites check passed`
- No `ERROR:` or `HALT:` in output

**On failure** (any of the three files missing):
- Stdout: Contains `ERROR:` + missing file name + corrective command
- Stdout: Contains `HALT:`

**Check order on failure**: spec.md checked first, then plan.md, then tasks.md. The hook halts at the first missing file and reports it. The developer resolves one prerequisite at a time.

### Parent Skill Response Contract

Same logic as above — `HALT:` token triggers immediate stop.

---

## extensions.yml Registration Contract

The hook entries in `.specify/extensions.yml` MUST conform to the schema expected by speckit-tasks and speckit-implement SKILL.md files:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| extension | string | yes | Human-readable name for log output |
| command | string | yes | Dot-notation; maps to slash command by replacing dots with hyphens |
| description | string | yes | Short description |
| optional | boolean | yes | false = mandatory (HALT honored); true = advisory only |
| enabled | boolean | yes | false = hook skipped entirely |

**Command mapping rule**: `speckit.check-prerequisites` → `/speckit-check-prerequisites`
