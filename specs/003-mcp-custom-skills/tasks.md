# Tasks: MCP Integration and Custom Skills — MVP2

**Input**: Design documents from `specs/003-mcp-custom-skills/`

**Prerequisites**: spec.md (5 user stories), constitution.md (Human Oversight, Privacy, AI Safety). Note: no plan.md exists for this feature; tech stack inferred from `specs/001-ai-backlog-refinement/plan.md` (Nx, Angular 17, NestJS 10, Anthropic TypeScript SDK).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in all descriptions

## Path Conventions

Based on MVP1 source tree:
- **Backend**: `apps/api/src/`
- **Frontend**: `apps/web/src/app/`
- **Shared types**: `libs/shared/src/`
- **Claude Code skills**: `.claude/skills/`
- **Specs**: `specs/003-mcp-custom-skills/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce MCP dependencies, credential infrastructure, and Claude Code MCP config

- [ ] T001 Add MCP packages as dev dependencies in `package.json`: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/server-jira`, `@modelcontextprotocol/server-linear`, `@modelcontextprotocol/server-github`
- [ ] T002 [P] Create `.env.example` co-located with `backlog-assistant.exe` output — include placeholder keys for `JIRA_API_TOKEN`, `JIRA_BASE_URL`, `LINEAR_API_KEY`, `GITHUB_TOKEN` with comments
- [ ] T003 Update `.gitignore` to exclude `.env`, `.env.local`, and any `*.env` files from version control
- [ ] T004 Update `pkg.config.json` to explicitly exclude `.env` from the packaged `backlog-assistant.exe` binary
- [ ] T005 [P] Create `.claude/mcp.json` with MCP server config stubs for Jira, Linear, and GitHub — used exclusively by Claude Code CLI skills, not by the app

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared entities and NestJS MCP infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Add `BacklogSystemConnection` entity to `libs/shared/src/entities/backlog-system-connection.entity.ts` — fields: `systemType` (Jira/Linear/GitHub), `apiEndpoint`, `projectKey`, `status` (active/error/unconfigured)
- [ ] T007 [P] Add `LiveBacklogContext` entity to `libs/shared/src/entities/live-backlog-context.entity.ts` — fields: `sourceSystemType`, `projectKey`, `fetchTimestamp`, `itemCount`, `truncated`, `items[]` (title, description, priority, category — read-only)
- [ ] T008 [P] Add `ExternalPublishTarget` and `PublishResult` entities to `libs/shared/src/entities/external-publish.entity.ts` — `PublishResult` fields: `internalItemId`, `externalIssueId`, `status`, `errorMessage`, `retryEligible`
- [ ] T009 [P] Add `PromptTuneReport` entity to `libs/shared/src/entities/prompt-tune-report.entity.ts` — fields: `reportDate`, `promptAnalyses[]` (promptFile, version, approvalRate, amendmentRate, lowConfidenceRate, suggestions)
- [ ] T010 Create `apps/api/src/mcp/mcp.module.ts` and `apps/api/src/mcp/mcp.service.ts` — NestJS MCP client wrapper; registers module with `AppModule` (depends on T006)
- [ ] T011 [P] Create `apps/api/src/credentials/credentials.service.ts` — reads `.env` file; serves only anonymized system references (type + project key) to callers; credential values MUST NEVER be passed to `ai.service.ts` or any AI call
- [ ] T012 Create `apps/api/src/mcp/adapters/jira.adapter.ts` — Jira Cloud MCP adapter implementing a shared `BacklogAdapter` interface (depends on T010)
- [ ] T013 [P] Create `apps/api/src/mcp/adapters/linear.adapter.ts` — Linear MCP adapter implementing `BacklogAdapter` (depends on T010)
- [ ] T014 [P] Create `apps/api/src/mcp/adapters/github.adapter.ts` — GitHub Issues MCP adapter implementing `BacklogAdapter` (depends on T010)
- [ ] T015 Create `apps/api/src/mcp/backlog-query.service.ts` — system-agnostic query service; dispatches to correct adapter based on `systemType`; enforces 200-item cap (most-recently-updated first); sets `truncated` flag (depends on T012, T013, T014)

**Checkpoint**: MCP infrastructure ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Live Backlog Context During Analysis (Priority: P1) 🎯 MVP

**Goal**: Replace manual JSON upload with live backlog queries from Jira, Linear, or GitHub; fall back to JSON upload when connection is unavailable.

**Independent Test**: Configure Jira with a valid project key. Submit a two-page PDF without uploading JSON. Verify Key Requirements Summary and AI stories appear, at least one story shows "Existing overlap" against a live Jira item, and no file upload prompt appears while a live connection is active.

### Implementation for User Story 1

- [ ] T016 [P] [US1] Update `apps/api/src/analyse/analyse.dto.ts` — add optional `backlogSystemType` and `projectKey` fields; make existing JSON upload optional
- [ ] T017 [US1] Update `apps/api/src/analyse/analyse.service.ts` to call `BacklogQueryService` when `backlogSystemType` is present; emit `connection_error` SSE event and fall back to JSON on failure (depends on T015, T016)
- [ ] T018 [US1] Update `apps/api/src/overlap/overlap.service.ts` to accept `LiveBacklogContext` as overlap context source alongside legacy `ExistingBacklogItem[]` (depends on T007, T017)
- [ ] T019 [P] [US1] Update `apps/web/src/app/features/input/input.component.ts` — conditionally hide JSON upload field when `isLiveConnectionActive$` is true; show connection status badge
- [ ] T020 [US1] Update `apps/web/src/app/core/session.service.ts` — add `backlogSystemConnection: BacklogSystemConnection` to `SessionState`; expose `isLiveConnectionActive$` observable (depends on T006)
- [ ] T021 [US1] Update `apps/web/src/app/core/analysis.service.ts` — pass `backlogSystemType` and `projectKey` to `POST /api/analyse` when live connection active; pass JSON otherwise (depends on T020)
- [ ] T022 [P] [US1] Create `apps/web/src/app/shared/components/backlog-connection-status.component.ts` — displays active system type, project key, and connection error state
- [ ] T023 [US1] Implement connection failure fallback: handle `connection_error` SSE event in `apps/web/src/app/core/analysis.service.ts`; re-enable JSON upload in `input.component.ts` and display clear failure message (depends on T017, T021)
- [ ] T024 [US1] Add 200-item truncation notice: when `LiveBacklogContext.truncated` is true, emit `progress` SSE event with truncation message from `apps/api/src/analyse/analyse.service.ts` (depends on T017)
- [ ] T025 [US1] Add credential isolation assertion in `apps/api/src/credentials/credentials.service.ts` — unit-level guard ensuring no credential strings flow into `apps/api/src/ai/ai.service.ts` calls (depends on T011, T017)
- [ ] T026 [US1] Create `apps/web/src/app/features/input/backlog-system-settings.component.ts` — system type selector, project key input, "Test Connection" button that validates via `GET /api/mcp/status` (depends on T019, T020, T022)

**Checkpoint**: User Story 1 is fully functional — live context replaces JSON upload, fallback works, truncation notice shown

---

## Phase 4: User Story 2 — Publish Approved Items Directly to an External System (Priority: P1)

**Goal**: Reviewer clicks "Publish to [System]" after review; approved stories and tasks are created in Jira/Linear/GitHub with correct hierarchy; each item shows its external issue ID.

**Independent Test**: Complete a review session approving ≥ 2 stories each with ≥ 1 task. Click "Publish to Jira". Verify Jira issues created with correct hierarchy (epic → story → subtask), rejected items absent, and session shows Jira issue ID per created item.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Update `libs/shared/src/entities/external-publish.entity.ts` — add `confirmationRequired: true` flag and `publishTimestamp` to `ExternalPublishTarget` (depends on T008)
- [ ] T028 [US2] Create `apps/api/src/publish/external-publish.service.ts` — orchestrates item creation; builds epic → story → subtask hierarchy; surfaces per-item success/error; does not retry automatically (depends on T015, T027)
- [ ] T029 [US2] Create `apps/api/src/publish/publish.controller.ts` — `POST /api/publish/external` endpoint; requires `confirmed: true` in request body before any external API call (depends on T028)
- [ ] T030 [P] [US2] Update `apps/web/src/app/features/publish/publish.component.ts` — add "Publish to [System]" button; show only when `isLiveConnectionActive$` is true; show JSON download as fallback when not active
- [ ] T031 [US2] Create `apps/web/src/app/features/publish/publish-confirmation.component.ts` — pre-publish summary listing all items to be created; reviewer must click "Confirm" to proceed — required by Human Oversight principle (depends on T030)
- [ ] T032 [US2] Create `apps/web/src/app/features/publish/publish-results.component.ts` — per-item result display: external issue ID as reference link on success, error reason + retry button on failure (depends on T029, T031)
- [ ] T033 [US2] Implement idempotency guard in `apps/api/src/publish/external-publish.service.ts` — check session's `ExternalPublishTarget` for existing issue IDs before creating; skip and return existing ID for already-published items (depends on T028, T035)
- [ ] T034 [US2] Implement per-item retry in `apps/web/src/app/features/publish/publish.component.ts` — re-POST failed items to `POST /api/publish/external` without including already-created items (depends on T032, T033)
- [ ] T035 [US2] Update `apps/web/src/app/core/session.service.ts` — store `ExternalPublishTarget` results in `SessionState`; expose `publishedItems$` observable mapping story IDs to external issue IDs (depends on T020, T032)
- [ ] T036 [US2] Implement no-connection fallback in `apps/web/src/app/features/publish/publish.component.ts` — when `isLiveConnectionActive$` is false, show only JSON download button plus "Configure connection" prompt (depends on T030, T035)

**Checkpoint**: User Stories 1 AND 2 are independently functional — live context in, live publish out

---

## Phase 5: User Story 3 — Import Live Backlog via `/speckit-import-backlog` (Priority: P2)

**Goal**: Developer runs `/speckit-import-backlog [project-key]`; a `backlog-context.json` is written to the active feature directory; `spec.md` Assumptions section is updated with a reference.

**Independent Test**: With `.claude/mcp.json` configured for Jira, run `/speckit-import-backlog` with a valid project key. Verify `specs/003-mcp-custom-skills/backlog-context.json` is created with titles, statuses, and priorities, and that `spec.md` Assumptions references the file.

### Implementation for User Story 3

- [ ] T037 Create `.claude/skills/speckit-import-backlog/SKILL.md` — full skill definition: resolves active feature directory from `.specify/feature.json`, reads `.claude/mcp.json`, fetches backlog items, writes structured JSON, updates spec.md (depends on T005)
- [ ] T038 [P] [US3] Update `.claude/mcp.json` with fully configured MCP server entries for Jira, Linear, and GitHub — replace stubs from T005 with working connection config (depends on T005, T037)
- [ ] T039 [US3] Implement fetch-and-write step in `.claude/skills/speckit-import-backlog/SKILL.md`: query external system for project key, write `specs/[NNN]-[feature]/backlog-context.json` with structured items, report item count; exit with clear error on connection failure without creating partial file (depends on T037, T038)
- [ ] T040 [US3] Implement spec.md update step in `.claude/skills/speckit-import-backlog/SKILL.md`: append or update `backlog-context.json` reference in active feature's `spec.md` Assumptions section; overwrite existing `backlog-context.json` with refresh timestamp on re-run (depends on T039)

**Checkpoint**: User Story 3 is independently functional — `/speckit-import-backlog` fetches and records live backlog context

---

## Phase 6: User Story 4 — Push Published Backlog to Jira via `/speckit-publish-to-jira` (Priority: P2)

**Goal**: Developer runs `/speckit-publish-to-jira --feature [NNN]`; Jira epics/stories/subtasks are created from `PublishedBacklog` JSON; `jira-publish-result.json` maps internal IDs to Jira keys; re-runs skip already-created items.

**Independent Test**: With a valid `PublishedBacklog` JSON from a completed session, run `/speckit-publish-to-jira --feature 001`. Verify Jira issues created with epic → story → subtask hierarchy, rejected items absent, and skill outputs Jira issue key per created item.

### Implementation for User Story 4

- [ ] T041 Create `.claude/skills/speckit-publish-to-jira/SKILL.md` — full skill definition: reads `PublishedBacklog` JSON for `--feature [NNN]`, creates Jira hierarchy via MCP, writes `jira-publish-result.json`, implements idempotency
- [ ] T042 [P] [US4] Implement artifact read step in `.claude/skills/speckit-publish-to-jira/SKILL.md`: locate and parse `PublishedBacklog` JSON for the specified feature; filter to approved-only items; reject if file not found (depends on T041)
- [ ] T043 [US4] Implement Jira issue creation hierarchy in `.claude/skills/speckit-publish-to-jira/SKILL.md`: create epic first, then stories as children, then tasks as subtasks; continue on per-item failure and report each failure individually (depends on T042)
- [ ] T044 [US4] Implement `jira-publish-result.json` write step in `.claude/skills/speckit-publish-to-jira/SKILL.md`: write `specs/[NNN]-[feature]/jira-publish-result.json` mapping internal story/task IDs to created Jira issue keys; update incrementally when partial publish occurs (depends on T043)
- [ ] T045 [US4] Implement idempotency in `.claude/skills/speckit-publish-to-jira/SKILL.md`: on re-run, read `jira-publish-result.json` and skip items with existing Jira keys; report skipped count vs. newly created count (depends on T044)

**Checkpoint**: User Story 4 is independently functional — CLI-based Jira publish with idempotency

---

## Phase 7: User Story 5 — Improve Prompt Quality via `/speckit-prompt-tune` (Priority: P3)

**Goal**: Developer runs `/speckit-prompt-tune` after ≥ 3 completed sessions; a dated `prompt-tune-report.md` is created in `docs/prompts/` with per-prompt metrics and ≥ 1 specific actionable suggestion per prompt.

**Independent Test**: With ≥ 3 completed session audit log files, run `/speckit-prompt-tune`. Verify `docs/prompts/prompt-tune-report.md` is created, references each prompt file by version, and contains ≥ 1 specific actionable suggestion per prompt analyzed.

### Implementation for User Story 5

- [ ] T046 Create `.claude/skills/speckit-prompt-tune/SKILL.md` — full skill definition: locates session audit logs and `docs/prompts/` files, checks minimum log count, computes metrics, writes report
- [ ] T047 [P] [US5] Implement minimum log check in `.claude/skills/speckit-prompt-tune/SKILL.md`: count available session audit log files; if < 3, exit with clear message stating "Minimum 3 logs required; N available" without creating any output file (depends on T046)
- [ ] T048 [US5] Implement per-prompt metrics computation in `.claude/skills/speckit-prompt-tune/SKILL.md`: for each prompt file in `docs/prompts/`, compute approval rate (%), amendment rate (%), low-confidence rate (%) from audit logs (depends on T047)
- [ ] T049 [US5] Implement improvement suggestion generation in `.claude/skills/speckit-prompt-tune/SKILL.md`: for each prompt analyzed, produce ≥ 1 specific, actionable suggestion — not a generic observation; suggestions must reference actual metric values (depends on T048)
- [ ] T050 [US5] Implement report output in `.claude/skills/speckit-prompt-tune/SKILL.md`: write or append to `docs/prompts/prompt-tune-report.md`; append a dated section on re-run rather than overwrite; include prompt file path and version in each section (depends on T049)

**Checkpoint**: All user stories are independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, duplicate guards, and documentation that spans multiple stories

- [ ] T051 [P] Add token expiry error handling in `apps/api/src/mcp/adapters/` — when external API returns a 401/403, surface per-item `TOKEN_EXPIRED` error and include a "Reconfigure .env and restart" instruction in the SSE error payload
- [ ] T052 [P] Add double-publish guard in `apps/web/src/app/features/publish/publish.component.ts` — before calling `POST /api/publish/external`, check `publishedItems$`; if item already has an external ID, show existing ID instead of re-submitting
- [ ] T053 [P] Create `docs/decisions/ADR-005-mcp-integration.md` — document decision to adopt MCP for live backlog connectivity, credential management via `.env`, and adapter-per-system pattern; include Status, Context, Decision, Consequences sections
- [ ] T054 [P] Create `docs/decisions/ADR-006-live-backlog-fallback.md` — document live-context-with-JSON-fallback strategy, 200-item cap rationale, and decision to keep MVP1 flows intact as fallbacks
- [ ] T055 Update `docs/spec/00-overview.md` to reflect MVP2 scope: add feature 003 entry, list five new user stories, reference three new Claude Code skills, note MCP dependency, and update project status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 & US2 (Phases 3–4)**: Depend on Phase 2 completion; US2 may proceed alongside US1 after T015 is done
- **US3 & US4 (Phases 5–6)**: Depend on Phase 2 (T005 and T015); independent of US1 and US2 at the code level
- **US5 (Phase 7)**: Depends only on Phase 1 (directory structure); independent of all other stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Start after Phase 2 complete — no dependency on US2–US5
- **User Story 2 (P1)**: Start after Phase 2 complete — integrates with US1 session state (T020) but independently testable
- **User Story 3 (P2)**: Start after T005 and T037 — independent of US1 and US2 app changes
- **User Story 4 (P2)**: Start after T041 — independent of US1, US2, and US3
- **User Story 5 (P3)**: Start after Phase 1 — no app dependency

### Within Each User Story

- Entities (`libs/shared/`) before services (`apps/api/src/`)
- NestJS services before Angular consumers
- Angular components after the services they inject
- Idempotency guards after the resources they protect

### Parallel Opportunities

- T006, T007, T008, T009, T011 — all shared entity and credential tasks run in parallel
- T012, T013, T014 — all three MCP adapters run in parallel after T010
- T016, T019, T022 — DTO, Angular component, and status badge run in parallel
- T027, T030 — entity update and publish button run in parallel
- T037, T038 — skill definition and MCP config update run in parallel (T038 starts after T005)
- T042, T047 — skill read steps run in parallel within their respective stories
- T051, T052, T053, T054 — all Polish tasks run in parallel

---

## Parallel Example: User Story 1

```
# After Phase 2 completes, launch these together:
Task T016: Update analyse.dto.ts (backend DTO)
Task T019: Update input.component.ts (frontend)
Task T022: Create backlog-connection-status.component.ts (frontend)

# Then launch:
Task T017: Update analyse.service.ts (depends on T015, T016)
Task T020: Update session.service.ts (depends on T006)
```

## Parallel Example: User Story 2

```
# After Phase 2 completes, launch these together:
Task T027: Update external-publish.entity.ts
Task T030: Update publish.component.ts

# Then sequentially:
Task T028: Create external-publish.service.ts
Task T029: Create publish.controller.ts
Task T031: Create publish-confirmation.component.ts
Task T032: Create publish-results.component.ts
Task T035: Update session.service.ts
Task T033: Add idempotency guard
Task T034: Add per-item retry
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 → **validate independently**
4. Complete Phase 4: User Story 2 → **validate independently**
5. **STOP and VALIDATE**: Full live-in/live-out cycle works end to end
6. Demo or ship MVP2 App

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → live context replaces JSON upload → **demo/validate**
3. US2 → direct publish closes the loop → **demo/validate**
4. US3 → `/speckit-import-backlog` enriches spec authoring → **demo/validate**
5. US4 → `/speckit-publish-to-jira` covers CLI workflow → **demo/validate**
6. US5 → `/speckit-prompt-tune` improves long-term quality → **demo/validate**

### Parallel Team Strategy

With multiple developers after Phase 2:
- Developer A: User Story 1 (app live context)
- Developer B: User Story 2 (app direct publish)
- Developer C: User Stories 3 + 4 (Claude Code skills — independent of app changes)
- Developer D: User Story 5 (prompt tuning skill — fully independent)

---

## Notes

- `[P]` tasks involve different files and have no incomplete dependencies — safe to parallelize
- Each user story phase is a complete, independently testable increment
- Human Oversight (constitution principle I): T031 (publish confirmation) is NON-NEGOTIABLE — no API call without explicit reviewer click
- Privacy (constitution principle III): T011 and T025 enforce that credential values never reach the AI model — these must be verified before US1 ships
- Credential values MUST NOT appear in any SSE payload, audit log entry, or AI prompt
- Commit after each task or logical group; run `/speckit-converge` after completing each user story phase to catch gaps before starting the next
