# Tasks: GitHub Projects Backlog Integration via Local GitHub MCP Server

**Input**: Design documents from `specs/006-github-projects-mcp/`

**Prerequisites**: spec.md (5 user stories — US1 P1, US1b P1 TOP PRIORITY, US2 P1, US3 P1, US4 P2), plan.md, data-model.md, contracts/github-projects-api.md, research.md, quickstart.md. Tech stack inherited from `specs/001-ai-backlog-refinement/plan.md` (Nx, Angular 17, NestJS 10) plus `@github/github-mcp-server` and `@modelcontextprotocol/sdk`.

**Supersedes**: `specs/003-mcp-custom-skills/tasks.md` — replaces all Jira/Linear adapter tasks with a single GitHub Projects MCP client. US1b (Browse Backlog) is a new top-priority addition clarified on 2026-07-07.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US1b, US2, US3, US4)
- Exact file paths are included in all descriptions

## Path Conventions

- **Backend**: `apps/api/src/`
- **Frontend**: `apps/web/src/app/`
- **Shared types**: `libs/shared/src/`
- **Claude Code skills**: `.claude/skills/`
- **Specs**: `specs/006-github-projects-mcp/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install GitHub MCP server package, update credential infrastructure

- [ ] T001 Add `@github/github-mcp-server` and `@modelcontextprotocol/sdk` to devDependencies in `package.json`; run `npm install`
- [ ] T002 [P] Update `.env.example` to include `GITHUB_TOKEN=<your_github_pat_here>` with a comment explaining required scopes (`project`, `repo` or `public_repo`)
- [ ] T003 [P] Verify `.gitignore` excludes `.env`, `.env.local`, and `*.env` — add entries if missing
- [ ] T004 [P] Verify `pkg.config.json` explicitly excludes `.env` from the packaged `backlog-assistant.exe` binary — add entry if missing
- [ ] T005 [P] Create `.claude/mcp.json` (or update if it exists) with GitHub MCP server stub entry: `command: "npx"`, `args: ["-y", "@github/github-mcp-server", "stdio"]`, `env: { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }` — for Claude Code skills only

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared entities and the NestJS GitHub MCP client module that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Add `GitHubProjectsConnection` entity to `libs/shared/src/entities/github-projects-connection.entity.ts` — fields: `owner` (string), `projectNumber` (number), `projectName` (string), `repoOwner` (string), `repoName` (string), `status` (`active` | `error` | `unconfigured`), `errorMessage` (string | null), `itemCount` (number | null)
- [ ] T007 [P] Add `GitHubProjectItem` entity to `libs/shared/src/entities/github-project-item.entity.ts` — fields: `issueNumber` (number), `title` (string), `body` (string | null), `status` (string), `priority` (string | null), `labels` (string[]), `updatedAt` (Date), `repositoryName` (string)
- [ ] T008 [P] Add `GitHubPublishResult` and `GitHubPublishSession` entities to `libs/shared/src/entities/github-publish.entity.ts` — `GitHubPublishResult`: `internalItemId`, `githubIssueNumber`, `githubIssueUrl`, `status` (`created` | `failed` | `skipped`), `errorMessage`, `retryEligible`; `GitHubPublishSession`: `publishTimestamp`, `projectOwner`, `projectNumber`, `repoOwner`, `repoName`, `results[]`
- [ ] T009 Create `apps/api/src/github-mcp/github-mcp.module.ts` — NestJS module that spawns `@github/github-mcp-server` as a child process via `child_process.spawn` with stdio transport; reads `GITHUB_TOKEN` from `.env` via `ConfigService`; registers `GithubMcpClientService` and exports it
- [ ] T010 Create `apps/api/src/github-mcp/github-mcp-client.service.ts` — wraps `@modelcontextprotocol/sdk` `Client` over the spawned subprocess via `StdioClientTransport`; exposes `callTool(toolName, args): Promise<unknown>`; handles subprocess crash by updating connection status; terminates subprocess on `OnApplicationShutdown` (depends on T009)
- [ ] T011 [P] Create `apps/api/src/github-mcp/github-mcp-credentials.service.ts` — reads `GITHUB_TOKEN` from `.env` via `ConfigService`; exposes only `getTokenPresent(): boolean` — MUST NEVER expose raw token value to any caller or response body
- [ ] T012 Register `GithubMcpModule` as a global module in `apps/api/src/app.module.ts`; add `OnApplicationShutdown` hook to ensure clean subprocess termination on app exit (depends on T009, T010)

**Checkpoint**: GitHub MCP client infrastructure ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Configure GitHub Local MCP Server and Select Project Board (Priority: P1)

**Goal**: Reviewer can configure a GitHub Projects connection via the Settings UI; connection status badge persists across all routes; MCP subprocess terminates cleanly on exit.

**Independent Test**: Set `GITHUB_TOKEN` in `.env`. Launch app. Navigate to Settings → GitHub Projects. Enter valid org and project number. Click "Test Connection". Verify badge reads "Connected — [Project Name]" in header. Close app and confirm no orphan subprocess remains.

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create `apps/api/src/github-projects/github-projects.module.ts` and `apps/api/src/github-projects/github-projects.controller.ts` — skeleton with `GET /api/github-projects/status`, `POST /api/github-projects/configure`, and `GET /api/github-projects/boards` routes; register in `AppModule`
- [ ] T014 [US1] Create `apps/api/src/github-projects/github-projects.service.ts` — implements `getStatus(): GitHubProjectsConnection`, `configure(owner, projectNumber, repoOwner, repoName): Promise<GitHubProjectsConnection>`, and `listBoards(owner): Promise<{number, name}[]>` by calling `GithubMcpClientService.callTool()`; stores active config in-memory; validates against MCP server before confirming (depends on T010, T006)
- [ ] T015 [P] [US1] Add `githubConnection: GitHubProjectsConnection | null` to `SessionState` in `apps/web/src/app/core/session.service.ts`; expose `githubConnection$: Observable<GitHubProjectsConnection | null>` and `isGithubConnected$: Observable<boolean>` (depends on T006)
- [ ] T016 [P] [US1] Create `apps/web/src/app/features/settings/github-projects-config.component.ts` — standalone Angular component; form with `owner` input, project board dropdown (via `GET /api/github-projects/boards`), `repoOwner` and `repoName` inputs, and "Test Connection" button; shows project name + item count on success; shows error on failure (depends on T013, T015)
- [ ] T017 [US1] Create `apps/web/src/app/shared/components/github-connection-badge.component.ts` — standalone Angular component; displays "Connected — [Project Name]" (green) / "GitHub — Not configured" (grey) / "GitHub — Error" (red) in the app header; subscribes to `githubConnection$` from `SessionService` (depends on T015)
- [ ] T018 [US1] Add `GithubConnectionBadgeComponent` selector to `apps/web/src/app/app.component.html` in the header region so it persists across all routes (depends on T017)
- [ ] T019 [US1] Add a `settings/github-projects` lazy route to `apps/web/src/app/app.routes.ts` and add a "Settings" nav link or gear icon to `apps/web/src/app/app.component.html` that navigates to this route (depends on T016, T018)

**Checkpoint**: US1 fully functional — reviewer can configure a GitHub Projects connection, see the badge in the header, and the MCP subprocess terminates cleanly on app exit

---

## Phase 4: User Story 1b — Browse Connected GitHub Projects Backlog (Priority: P1) ⭐ TOP PRIORITY ADDITION

**Goal**: Reviewer opens `/backlog` via top-level nav link and sees a read-only, searchable, filterable list of up to 200 GitHub Projects items. Row click expands to show body. Refresh re-fetches. Empty states for not-connected, zero-items, and no-filter-matches.

**Independent Test**: With active GitHub Projects connection (≥ 3 items), navigate to `/backlog`. Verify: item list shows issue#, title, status, priority, labels, date; keyword search filters titles in real time; status + priority dropdowns narrow list; Refresh shows loading indicator and updates list; clicking a row expands body inline. Then disconnect and verify "No GitHub Projects connected" empty state with Settings link appears.

### Implementation for User Story 1b

- [ ] T020 [US1b] Create `apps/api/src/github-projects/github-projects-context.service.ts` — implements `fetchItems(owner, projectNumber): Promise<{ items: GitHubProjectItem[], truncated: boolean }>` by calling `GithubMcpClientService.callTool('list_project_items', ...)` with pagination (2 calls × 100 items); sorts results by `updatedAt` descending; caps at 200; sets `truncated: true` when project has more than 200 items (depends on T010, T007)
- [ ] T021 [US1b] Add `GET /api/github-projects/items` endpoint to `apps/api/src/github-projects/github-projects.controller.ts` — calls `GithubProjectsContextService.fetchItems()` with the active session's owner and projectNumber; returns `{ items: GitHubProjectItem[], truncated: boolean }`; returns 503 when connection is unconfigured (depends on T020, T013)
- [ ] T022 [P] [US1b] Create `apps/web/src/app/features/backlog/github-backlog.service.ts` — Angular injectable; wraps `HttpClient.get<{ items: GitHubProjectItem[], truncated: boolean }>('/api/github-projects/items')`; returns `Observable<...>`; handles HTTP errors
- [ ] T023 [P] [US1b] Add `/backlog` lazy route to `apps/web/src/app/app.routes.ts` — `{ path: 'backlog', loadComponent: () => import('./features/backlog/backlog.component').then(m => m.BacklogComponent) }`
- [ ] T024 [US1b] Add "Backlog" top-level nav link to `apps/web/src/app/app.component.html` — Angular Material button or nav item with `routerLink="/backlog"` and `routerLinkActive="active"`; always visible in the header alongside "Start Refinement" and Settings (depends on T023)
- [ ] T025 [US1b] Create `apps/web/src/app/features/backlog/backlog.component.ts` — Angular standalone component; injects `GithubBacklogService` and `SessionService`; on init, calls `fetchItems()` when `isGithubConnected$` is true; stores results in `items = signal<GitHubProjectItem[]>([])`, `isLoading = signal(false)`, `truncated = signal(false)`; exposes `searchTerm = signal('')`, `statusFilter = signal('All')`, `priorityFilter = signal('All')`, `expandedItemId = signal<number | null>(null)` (depends on T022, T015)
- [ ] T026 [US1b] Implement `filteredItems = computed(...)` in `apps/web/src/app/features/backlog/backlog.component.ts` — applies keyword search (case-insensitive title substring match), status filter, and priority filter sequentially; client-side only; no additional API call; ≤200ms per keystroke for ≤200 items (depends on T025)
- [ ] T027 [US1b] Implement "Refresh" button handler in `apps/web/src/app/features/backlog/backlog.component.ts` — sets `isLoading(true)`, re-calls `GithubBacklogService.fetchItems()`, updates `items` signal, resets `isLoading(false)` on completion or error (depends on T025)
- [ ] T028 [US1b] Build `apps/web/src/app/features/backlog/backlog.component.html` — layout: (1) header row with search `mat-form-field`, status `mat-select`, priority `mat-select`, and "Refresh" `mat-icon-button` with spinner; (2) truncation notice banner when `truncated()` is true; (3) `mat-accordion` list where each `mat-expansion-panel` header shows `#{{item.issueNumber}}`, title, status chip, priority chip, labels; expanded panel shows `body` or "No description" placeholder (depends on T025, T026, T027)
- [ ] T029 [P] [US1b] Implement three empty states in `apps/web/src/app/features/backlog/backlog.component.html` — (1) when `!isGithubConnected$`: "No GitHub Projects connected" + `mat-button` linking to `/settings/github-projects`; (2) when connected + `items().length === 0` + not loading: "No items found in this project"; (3) when `filteredItems().length === 0` + `items().length > 0`: "No items match your search or filters" + "Clear filters" button (depends on T028)
- [ ] T030 [US1b] Wire search and filter controls to signals in `apps/web/src/app/features/backlog/backlog.component.ts` + `.html` — `(input)` event on search field updates `searchTerm`; `(selectionChange)` on status/priority mat-select updates respective filter signals; "Clear filters" button resets all three signals to defaults (depends on T026, T028, T029)

**Checkpoint**: US1b fully functional — `/backlog` route accessible via top-level nav; items list loads, searches, filters, refreshes, and expands; all empty states render correctly

---

## Phase 5: User Story 2 — Live GitHub Projects Context During Analysis (Priority: P1)

**Goal**: When a GitHub Projects connection is active, analysis fetches live project items as read-only AI context; JSON upload is hidden; fallback re-enables JSON upload if connection fails.

**Independent Test**: With active connection, submit PDF without JSON file. Verify no JSON upload field shown, "Fetching GitHub Projects context…" in progress, at least one story shows "Existing overlap", truncation notice appears when > 200 items. Disconnect and resubmit — verify fallback message and JSON upload reappear.

### Implementation for User Story 2

- [ ] T031 [P] [US2] Add `backlogSourceType` (`'live-github'` | `'json-upload'` | `'none'`) and optional `githubProjectOwner`, `githubProjectNumber` fields to `apps/api/src/analyse/analyse.dto.ts`
- [ ] T032 [US2] Update `apps/api/src/analyse/analyse.service.ts` — when `backlogSourceType === 'live-github'`, call `GithubProjectsContextService.fetchItems()` before invoking AI; emit `progress` SSE event "Fetching GitHub Projects context…"; on MCP failure emit `connection_error` SSE event and fall back to JSON upload path (depends on T020, T031)
- [ ] T033 [US2] Update `apps/api/src/overlap/overlap.service.ts` to accept `GitHubProjectItem[]` as an overlap context source alongside existing `ExistingBacklogItem[]` — map `GitHubProjectItem.title` to the same overlap-check logic (depends on T007, T032)
- [ ] T034 [US2] Add truncation SSE notice in `apps/api/src/analyse/analyse.service.ts` — when `GithubProjectsContextService` returns `truncated: true`, emit `progress` SSE event "Context limited to 200 most-recent items" before analysis begins (depends on T020, T032)
- [ ] T035 [P] [US2] Update `apps/web/src/app/features/input/input.component.ts` — subscribe to `isGithubConnected$`; hide JSON upload field and show "Using live GitHub Projects context" notice when `true`; show JSON upload normally when `false` (depends on T015)
- [ ] T036 [US2] Update `apps/web/src/app/core/analysis.service.ts` — when `isGithubConnected$` is true, pass `backlogSourceType: 'live-github'` and active `owner`/`projectNumber` to `POST /api/analyse`; pass JSON otherwise (depends on T015, T031, T035)
- [ ] T037 [US2] Handle `connection_error` SSE event in `apps/web/src/app/core/analysis.service.ts` — display "GitHub connection failed — falling back to manual upload" message in the progress indicator; re-enable the JSON upload field in `input.component.ts` (depends on T032, T036, T035)

**Checkpoint**: US2 fully functional — live GitHub Projects context replaces JSON upload; overlap detection works; truncation notice shown; JSON fallback re-enables on MCP failure

---

## Phase 6: User Story 3 — Publish Approved Items Directly to GitHub Projects via MCP (Priority: P1)

**Goal**: Reviewer publishes approved stories and tasks to GitHub as Issues on the configured project board, with confirmation modal, per-item results, idempotency, and retry support.

**Independent Test**: Approve ≥ 2 stories with ≥ 1 task each. Click "Publish to GitHub Projects". Verify confirmation modal. Click Confirm. Verify GitHub Issues created (with labels, acceptance criteria in body), task issues linked to parent stories, all issues on board, session shows issue numbers with links. Re-publish — verify no duplicates. Fail one item — verify per-item error and Retry button.

### Implementation for User Story 3

- [ ] T038 [P] [US3] Add `githubPublishSession: GitHubPublishSession | null` to `SessionState` in `apps/web/src/app/core/session.service.ts`; expose `githubPublishResults$: Observable<GitHubPublishResult[]>` and `publishedItemMap$: Observable<Map<string, number>>` mapping `internalItemId` → `githubIssueNumber` (depends on T008, T015)
- [ ] T039 [US3] Create `apps/api/src/github-projects/github-projects-publish.service.ts` — orchestrates issue creation: (1) creates story issues first with labels (`priority:X`, category, `backlog-assistant`) and acceptance criteria in body; (2) creates task issues using sub-issues API or title-prefix fallback (`[US#N]`); (3) adds all issues to the configured GitHub Projects board; (4) implements idempotency check (skips items with existing `githubIssueNumber` in session); returns `GitHubPublishSession` (depends on T010, T008, T006)
- [ ] T040 [US3] Add `POST /api/github-projects/publish` endpoint to `apps/api/src/github-projects/github-projects.controller.ts` — MUST reject requests without `confirmed: true` with 400 Bad Request (constitution Principle I); calls `GithubProjectsPublishService.publish()`; returns `GitHubPublishSession` (depends on T039, T013)
- [ ] T041 [P] [US3] Update `apps/web/src/app/features/publish/publish.component.ts` — when `isGithubConnected$` is true, show "Publish to GitHub Projects" button; when false, show only JSON download button with "Configure GitHub Projects" prompt (depends on T015, T038)
- [ ] T042 [US3] Create `apps/web/src/app/features/publish/github-publish-confirmation.component.ts` — Angular Material dialog/modal listing all approved stories and tasks to be created; "Confirm" button triggers `POST /api/github-projects/publish` with `{ confirmed: true, items: [...] }`; "Cancel" closes without any API call — the confirmation click is the only trigger for publish (depends on T040, T041)
- [ ] T043 [US3] Create `apps/web/src/app/features/publish/github-publish-results.component.ts` — per-item result display; success: GitHub issue number as clickable link (`#N — title`); failure: error reason + "Retry" button; subscribes to `githubPublishResults$` (depends on T038, T042)
- [ ] T044 [US3] Implement per-item retry in `apps/web/src/app/features/publish/publish.component.ts` — "Retry failed items" re-posts only the `retryEligible: true` items to `POST /api/github-projects/publish`; idempotency guard in `GithubProjectsPublishService` automatically skips already-created items (depends on T039, T043, T041)
- [ ] T045 [US3] Update `apps/web/src/app/core/session.service.ts` to store `GitHubPublishSession` results returned from `POST /api/github-projects/publish` in `githubPublishSession` session state; refresh `publishedItemMap$` after each publish response (depends on T038, T043)

**Checkpoint**: US3 fully functional — confirmation required, stories + tasks created as GitHub Issues on the configured board, idempotency prevents duplicates, retry available per item

---

## Phase 7: User Story 4 — `/speckit-import-backlog` Updated for GitHub MCP (Priority: P2)

**Goal**: `/speckit-import-backlog --owner [org] --project [number]` fetches GitHub Projects items via the local MCP server and writes `backlog-context.json` to the active feature directory; `spec.md` Assumptions updated with a reference.

**Independent Test**: With `.claude/mcp.json` configured and `GITHUB_TOKEN` exported, run `/speckit-import-backlog --owner myorg --project 5`. Verify `specs/[NNN]-[feature]/backlog-context.json` created with items (title, status, priority, `fetchedAt`). Verify `spec.md` Assumptions references file. Re-run — file overwritten with updated `fetchedAt`.

### Implementation for User Story 4

- [ ] T046 Update `.claude/mcp.json` with fully configured GitHub MCP server entry: `command: "npx"`, `args: ["-y", "@github/github-mcp-server", "stdio"]`, env reading `GITHUB_PERSONAL_ACCESS_TOKEN` from `$GITHUB_TOKEN` — replace any stubs from T005 with a working entry (depends on T005)
- [ ] T047 [P] [US4] Create or update `.claude/skills/speckit-import-backlog/SKILL.md` — full skill definition: (1) verify `.claude/mcp.json` has GitHub server entry; (2) resolve active feature directory from `.specify/feature.json`; (3) call `list_project_items` MCP tool with `--owner` and `--project` args; (4) write structured JSON to `specs/[NNN]-[feature]/backlog-context.json` with fields: `issueNumber`, `title`, `body`, `status`, `priority`, `labels`, `updatedAt`, `fetchedAt` (ISO timestamp); (5) append or update Assumptions in active `spec.md` with a reference to `backlog-context.json` (depends on T046)
- [ ] T048 [US4] Implement error handling in `.claude/skills/speckit-import-backlog/SKILL.md` — on MCP connection failure exit with "GitHub MCP server unreachable — check GITHUB_TOKEN and .claude/mcp.json" without creating a partial file; on zero items create an empty array file and report "0 items fetched" (depends on T047)
- [ ] T049 [US4] Implement overwrite-with-refresh in `.claude/skills/speckit-import-backlog/SKILL.md` — if `backlog-context.json` already exists, overwrite with fresh fetch and updated `fetchedAt`; update the `spec.md` Assumptions reference timestamp accordingly (depends on T048)

**Checkpoint**: US4 fully functional — `/speckit-import-backlog` fetches live GitHub Projects context and records it in the feature directory

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, documentation, and governance artifacts that span multiple user stories

- [ ] T050 [P] Add subprocess crash recovery in `apps/api/src/github-mcp/github-mcp-client.service.ts` — when `@github/github-mcp-server` exits unexpectedly, set `GitHubProjectsConnection.status` to `error`, emit `connectionLost$` observable, and surface "GitHub connection lost — please restart the app" on the next SSE response; do NOT auto-restart
- [ ] T051 [P] Add token scope validation in `apps/api/src/github-mcp/github-mcp-credentials.service.ts` — on startup, verify token has `project` and `repo` scopes via the MCP server; surface "Insufficient token permissions — required: project, repo" via `GET /api/github-projects/status` when scopes are missing
- [ ] T052 [P] Add GitHub API rate-limit handling in `apps/api/src/github-projects/github-projects-publish.service.ts` — when MCP server returns a rate-limit error, surface per-item "GitHub rate limit reached — retry after [reset time]" in `GitHubPublishResult.errorMessage`; do NOT auto-retry
- [ ] T053 [P] Verify `docs/decisions/ADR-006-github-projects-mcp.md` exists and is accurate (created during `/speckit-plan`) — update if spec changes from clarification session (US1b Browse Backlog) are not yet reflected
- [ ] T054 [P] Update `docs/spec/00-overview.md` — reflect final feature 006 scope: 5 user stories including the US1b Browse Backlog addition, all design artifacts complete, ADR-006 accepted
- [ ] T055 [P] Verify `specs/006-github-projects-mcp/quickstart.md` covers US1b — add Scenario 1b (Browse Backlog) validation steps if not already present: navigate to `/backlog`, verify item list, search, filter, and Refresh work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (T009, T010, T011)
- **US1b (Phase 4)**: Depends on Phase 2 (T010, T007) and US1's T015 (session state for `isGithubConnected$`)
- **US2 (Phase 5)**: Depends on Phase 2 and US1b's T020 (`GithubProjectsContextService`) — T020 is shared between US1b (browse endpoint) and US2 (analysis context)
- **US3 (Phase 6)**: Depends on Phase 2 and US1's T015 (session state) — independently testable after Phase 2
- **US4 (Phase 7)**: Depends on Phase 1 (T005) and T046 — fully independent of app code changes
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2 — no dependency on US1b, US2, US3, US4
- **US1b (P1)**: Start after Phase 2 + T015 — T020 (`GithubProjectsContextService`) is shared with US2; implement US1b first since it's the higher-priority addition
- **US2 (P1)**: Start after T020 is complete (created in US1b Phase 4) — independently testable; integrates session state from US1
- **US3 (P1)**: Start after Phase 2 + T015 — independently testable; does not depend on US1b or US2 completion
- **US4 (P2)**: Start after T046 — fully independent of app changes

### Within Each User Story

- Backend entities (`libs/shared/`) before backend services (`apps/api/src/`)
- Backend services before backend controllers
- Backend controllers before Angular services
- Angular services before Angular components
- Signal/computed definitions before template bindings
- Empty states implemented alongside the component (not deferred)

### Parallel Opportunities

- T001–T005: T002, T003, T004, T005 run in parallel after T001
- T006, T007, T008, T011: all in parallel (independent files)
- T013, T015, T016: controller skeleton, session state, and config component run in parallel after T014 draft
- T022, T023: Angular service and route registration run in parallel
- T024–T025: nav link and component creation run in parallel (different files)
- T029, T026: empty states and computed filter can be written in parallel
- T031, T035: DTO update and input component update run in parallel
- T038, T041: session state update and publish button run in parallel
- T050, T051, T052, T053, T054, T055: all Polish tasks run in parallel

---

## Parallel Example: User Story 1b

```
# After Phase 2 + T015 complete, launch together:
Task T022: Create github-backlog.service.ts (Angular HTTP service)
Task T023: Add /backlog lazy route to app.routes.ts

# Then launch T020 + T025 together:
Task T020: Create GithubProjectsContextService (backend, fetchItems)
Task T025: Create BacklogComponent (Angular, signals + service injection)

# Then:
Task T021: Add GET /api/github-projects/items endpoint (depends on T020)
Task T026: Implement filteredItems computed signal (depends on T025)
Task T027: Implement Refresh handler (depends on T025)

# Then:
Task T024: Add top-level Backlog nav link (depends on T023)
Task T028: Build backlog.component.html template (depends on T025, T026, T027)

# Finally:
Task T029: Implement empty states (depends on T028)
Task T030: Wire search + filter controls (depends on T026, T028, T029)
```

## Parallel Example: User Story 2

```
# After T020 (GithubProjectsContextService) complete, launch together:
Task T031: Update analyse.dto.ts (backend DTO)
Task T035: Update input.component.ts (Angular, hide JSON upload)

# Then launch:
Task T032: Update analyse.service.ts (depends on T020, T031)
Task T036: Update analysis.service.ts (Angular, depends on T015, T031, T035)

# Then:
Task T033: Update overlap.service.ts (depends on T032)
Task T034: Add truncation SSE (depends on T020, T032)
Task T037: Handle connection_error SSE event (depends on T032, T036, T035)
```

---

## Implementation Strategy

### MVP First (US1 + US1b + US2 + US3 — Full In-App Loop)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — CRITICAL, blocks everything
3. Complete Phase 3: US1 → **validate connection badge and config UI**
4. Complete Phase 4: US1b → **validate `/backlog` route with browse, search, filter, refresh**
5. Complete Phase 5: US2 → **validate live context replaces JSON upload**
6. Complete Phase 6: US3 → **validate publish to GitHub Projects**
7. **STOP and VALIDATE**: Full live-in/browse/live-out cycle works end to end
8. Demo or ship

### Incremental Delivery

1. Setup + Foundational → MCP client infrastructure ready
2. US1 → connection config + badge → **demo/validate** (verify MCP subprocess lifecycle)
3. US1b → `/backlog` browse screen → **demo/validate** (TOP PRIORITY — verify items visible before analysis)
4. US2 → live context replaces JSON upload → **demo/validate**
5. US3 → direct publish closes the loop → **demo/validate**
6. US4 → CLI skill for spec authoring → **demo/validate**

### Parallel Team Strategy

With multiple developers after Phase 2:
- Developer A: US1 (connection config UI + status badge)
- Developer B: US1b (Browse Backlog — `/backlog` route, component, search/filter)
- Developer C: US3 (publish flow — can start immediately after Phase 2)
- Developer D: US4 (Claude Code skill — fully independent)
- Developer A + B converge on US2 (live context) once US1b's T020 is done

---

## Notes

- `[P]` tasks involve different files and have no incomplete dependencies — safe to parallelize
- Each user story phase is a complete, independently testable increment
- **Human Oversight (constitution Principle I)**: T042 (publish confirmation modal) is NON-NEGOTIABLE — `POST /api/github-projects/publish` MUST reject requests without `confirmed: true`
- **Privacy (constitution Principle III)**: T011 (credentials service) MUST be verified to never expose `GITHUB_TOKEN` in any response, SSE payload, or AI prompt before any user story ships
- **US1b top priority**: `/backlog` route and browse screen (T020–T030) give reviewers visibility into the connected backlog BEFORE running analysis — this is the clarified top-priority feature addition
- T020 (`GithubProjectsContextService`) is shared between US1b (browse endpoint T021) and US2 (analysis context T032) — implement it in Phase 4 (US1b) so Phase 5 (US2) can depend on it
- Sub-issues API fallback (title-prefix `[US#N]`) is required by FR-012 — implement both paths in T039 before US3 is considered complete
- Run `/speckit-converge` after completing each user story phase to catch gaps before starting the next
- Commit after each task or logical group
