# Feature Specification: GitHub Projects Backlog Integration via Local GitHub MCP Server

**Feature Branch**: `006-github-projects-mcp`

**Created**: 2026-07-07

**Last Updated**: 2026-07-07

**Status**: Draft

**Supersedes**: `003-mcp-custom-skills` (replaces multi-system Jira/Linear/Azure DevOps integration with a focused GitHub Projects v2 integration via the official local GitHub MCP server)

**Input**: User description: "Update/replace spec for integration of jira, linear, or Azure devops,
with Github project's backlog integration via Github local MCP server implementation."

**Refinement**: Narrow the integration target from three external systems (Jira Cloud, Linear,
Azure DevOps) to a single, well-supported target — **GitHub Projects v2** — accessed exclusively
via the official local GitHub MCP server (`@github/github-mcp-server`, stdio transport). The MCP
server is spawned as a subprocess by the NestJS backend, which acts as an MCP client. Claude Code
skills are configured via `.claude/mcp.json` for the developer-workflow path. Credential storage
follows the same `.env`-only, no-packaging-into-exe model established in spec 003.

## Clarifications

- **Why GitHub Projects v2 only?** GitHub Projects v2 provides board and table views, custom
  fields, and issue hierarchies in a single platform already used by most open-source and
  enterprise teams. Focusing on one system well is more valuable than partial support for three.
- **Why local MCP server?** The official `@github/github-mcp-server` runs as a local stdio
  process — no cloud relay, no additional SaaS dependency. Credentials stay on the user's machine.
- **What about Azure DevOps?** Azure DevOps support remains post-MVP. There is no official
  Azure DevOps MCP server available at the time of this spec.
- **What about Linear?** Linear support is deferred. The GitHub Projects MCP path delivers more
  breadth (issues + project boards + labels) with a single token scoped only to the GitHub org.

### Session 2026-07-07

- Q: Does the spec include a dedicated screen for reviewers to connect to and browse the GitHub Projects backlog items as a read-only list? If not, add it as the top priority feature. → A: Add a dedicated read-only Backlog screen — a searchable, filterable list showing item number, title, status, priority, labels, and last-updated date. No item editing. Search filters by keyword across titles; filter controls for status and priority. A "Refresh" button re-fetches from GitHub.
- Q: Where should the Backlog screen live in the app's navigation? → A: Dedicated `/backlog` route with a top-level nav link always visible in the app header alongside "Start Refinement" — first-class feature, not hidden inside Settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Configure GitHub Local MCP Server and Select a Project Board (Priority: P1)

A developer or admin stores their GitHub Personal Access Token (classic) with `project` and `repo`
scopes in a local `.env` file. The app reads this token on startup to establish a connection with
the GitHub MCP server subprocess. The reviewer then opens the Settings panel in the UI, enters
their GitHub owner (org or user) and project number, and clicks "Test Connection". The app
confirms the project name and item count. A persistent connection status badge shows "Connected —
[Project Name]" in the header throughout the session. Closing the app terminates the MCP server
subprocess cleanly.

**Why this priority**: Without a working connection, neither live context (US2) nor direct publish
(US3) can function. Configuration is the prerequisite for everything else in this feature.

**Independent Test**: Set `GITHUB_TOKEN` in `.env` with a valid PAT. Launch the app. Open
Settings. Enter a valid GitHub org and project number. Click "Test Connection". Verify the panel
shows the project name and item count with no error. Verify the header badge reads
"Connected — [Project Name]". Close the app and verify the MCP server subprocess exits cleanly.

**Acceptance Scenarios**:

1. **Given** `GITHUB_TOKEN` is present and valid in `.env`, **When** the app starts, **Then**
   the NestJS backend spawns the `@github/github-mcp-server` subprocess via stdio and the
   connection status is `active`.
2. **Given** the reviewer enters a valid GitHub owner and project number and clicks "Test
   Connection", **Then** the app calls `GET /api/github-projects/status` and displays the
   project name and current item count within 5 seconds.
3. **Given** the reviewer enters an invalid project number, **Then** the app displays a
   "Project not found" error and the status remains `unconfigured`.
4. **Given** `GITHUB_TOKEN` is missing or invalid in `.env`, **When** the app starts, **Then**
   the MCP server fails to start, the header badge shows "GitHub — Not configured", and the
   reviewer is shown a setup guide linking to `.env.example`.
5. **Given** the reviewer selects a project and the connection is active, **When** they navigate
   to any analysis or publish page, **Then** the connection status badge remains visible and
   up-to-date.
6. **Given** the app is closed or the session ends, **Then** the `@github/github-mcp-server`
   subprocess is terminated and no orphan process remains.

---

### User Story 1b — Browse Connected GitHub Projects Backlog (Priority: P1) ⭐ TOP PRIORITY ADDITION

A reviewer with an active GitHub Projects connection clicks the **Backlog** link in the app's
top-level navigation (always visible in the header alongside "Start Refinement"), which routes to
`/backlog`. They see a searchable, read-only list of up to 200 items from the configured GitHub
Projects board, sorted by most-recently-updated. Each item shows: issue number (`#N`), title,
status badge, priority, labels, and last-updated date. The reviewer can type in a search field to
filter by keyword across item titles, and can use filter controls to narrow by status or priority.
A "Refresh" button re-fetches the latest items from GitHub. Clicking a row expands the item
inline to show the full issue body. No editing is possible from this screen. When no connection
is configured, the screen shows a "Not connected" empty state with a link to the Settings
configuration page.

**Why this priority**: Reviewers need to see what is already in their backlog before they run
analysis. Without a browsable view, the connection is invisible beyond an item count badge.
A readable list confirms the integration is pulling the correct items and gives reviewers
situational awareness before submitting new requirements. It also serves as the primary
verification step during initial setup.

**Independent Test**: With an active GitHub Projects connection (≥ 3 items in the project), open
the Backlog tab. Verify: (1) up to 200 items are listed, each showing issue number, title, status,
priority, and labels; (2) typing a keyword in the search field filters the list in real time;
(3) selecting a status filter narrows the list to matching items; (4) clicking "Refresh" shows a
loading indicator and updates the list; (5) with no connection configured, the tab shows
"No GitHub Projects connected" with a Settings link.

**Acceptance Scenarios**:

1. **Given** a GitHub Projects connection is active, **When** the reviewer opens the Backlog tab,
   **Then** the system displays up to 200 items sorted by most-recently-updated, each showing:
   issue number, title, status badge, priority label, all labels, and last-updated date.
2. **Given** items are displayed, **When** the reviewer types a keyword in the search field,
   **Then** the list filters in real time to show only items whose title contains the keyword;
   clearing the field restores the full list.
3. **Given** items are displayed, **When** the reviewer selects a status filter (e.g., "Open" /
   "Closed" / "In Progress"), **Then** only items matching that status are shown; selecting "All"
   restores the full list.
4. **Given** items are displayed, **When** the reviewer selects a priority filter, **Then** only
   items with that priority label are shown.
5. **Given** the reviewer clicks "Refresh", **Then** the list shows a loading indicator, re-fetches
   items from GitHub via the MCP server, and updates to reflect the latest project state.
6. **Given** the GitHub connection is unconfigured or in error state, **When** the reviewer opens
   the Backlog tab, **Then** a "No GitHub Projects connected" empty state is shown with a button
   linking to Settings → GitHub Projects configuration.
7. **Given** the project has zero items, **When** the reviewer opens the Backlog tab, **Then** a
   "No items found in this project" empty state is shown (not an error message).
8. **Given** items are displayed, **When** the reviewer clicks any item row, **Then** the item
   expands to show the full issue body (description) inline — no navigation away from the list.

---

### User Story 2 — Live GitHub Projects Context During Analysis (Priority: P1)

A reviewer opens the analysis input page with an active GitHub Projects connection. The optional
JSON file upload field is hidden. When the reviewer submits a requirements document, the NestJS
backend automatically fetches existing project items via the MCP server (up to 200, most-recently
updated first) and uses them as read-only AI context. Overlap detection flags AI-generated stories
that closely match existing project items with "Existing overlap — [item title]". If the
connection drops mid-analysis, the system displays a clear error and re-enables the JSON upload
fallback.

**Why this priority**: This is the primary value of the GitHub MCP integration — eliminating the
manual JSON export step that was the highest-friction point in the MVP1 workflow.

**Independent Test**: With `GITHUB_TOKEN` set and a valid project configured, submit a two-page
requirements PDF without uploading any JSON file. Verify: (1) no JSON upload field is visible,
(2) Key Requirements Summary and AI stories appear, (3) at least one story is flagged "Existing
overlap" against a live project item, (4) the progress indicator shows the live context fetch step.
Then disconnect the network and submit again — verify a clear fallback message and the JSON upload
field reappears.

**Acceptance Scenarios**:

1. **Given** a GitHub Projects connection is active, **When** the reviewer opens the input page,
   **Then** the JSON file upload field is hidden and a "Using live GitHub Projects context" notice
   is shown.
2. **Given** the reviewer submits input for analysis, **When** the backend processes the request,
   **Then** it calls the GitHub MCP server to fetch existing project items before invoking the AI,
   and the progress indicator shows "Fetching GitHub Projects context…" as a distinct step.
3. **Given** live items are fetched, **When** analysis completes, **Then** overlap detection runs
   against those items exactly as it does against uploaded JSON in MVP1, with "Existing overlap —
   [item title]" flags on matching stories.
4. **Given** the project has more than 200 items, **When** items are fetched, **Then** the most-
   recently-updated 200 items are used and the reviewer sees a "Context limited to 200 most-recent
   items" notice in the progress indicator.
5. **Given** the MCP server returns an error or times out during item fetch, **When** the reviewer
   submitted input, **Then** the system displays a "GitHub connection failed — falling back to
   manual upload" message, re-enables the JSON upload field, and continues the session.
6. **Given** a connection is active but the project has zero items, **When** analysis completes,
   **Then** no overlap checks run and no warning is shown — matching MVP1 behavior for an empty
   backlog JSON.

---

### User Story 3 — Publish Approved Items Directly to GitHub Projects via MCP (Priority: P1)

After completing the review workflow, a reviewer clicks "Publish to GitHub Projects". A
confirmation modal lists all items to be created before any API call is made. On confirmation,
approved user stories are created as GitHub Issues in the configured repository, with labels
mapping to priority and category. Approved tasks are created as GitHub Issues linked to their
parent story via the GitHub Projects sub-issues feature. All created issues are added to the
configured GitHub Projects board. The session shows the GitHub issue number and a direct link for
each created item. Failed items show a per-item error with a "Retry" button.

**Why this priority**: Direct publish closes the human-in-the-loop loop — context in, approved
output out — and delivers the primary end-to-end value of the GitHub Projects integration.

**Independent Test**: Complete a review session approving ≥ 2 stories each with ≥ 1 task. Click
"Publish to GitHub Projects". Verify the confirmation modal lists all items. Click Confirm. Verify:
(1) GitHub Issues are created for each approved story, (2) task issues are created and linked to
the parent story, (3) all issues appear on the configured GitHub Projects board, (4) each session
item shows a GitHub issue number with a link. Then re-click "Publish" and verify no duplicate
issues are created.

**Acceptance Scenarios**:

1. **Given** ≥ 1 approved story in the publish queue, **When** the reviewer clicks "Publish to
   GitHub Projects", **Then** a confirmation modal appears listing all items to be created — no
   API call is made until the reviewer clicks "Confirm".
2. **Given** the reviewer confirms, **Then** approved stories are created as GitHub Issues with:
   title, description, priority label (`priority:high/medium/low`), category label, and the
   acceptance criteria in the issue body.
3. **Given** a story has approved tasks, **Then** each task is created as a GitHub Issue linked
   to its parent story issue via GitHub's sub-issues API, and both the story and task issues are
   added to the configured GitHub Projects board.
4. **Given** all items are created successfully, **Then** each session item shows the GitHub issue
   number as a clickable link (e.g., `#42 — story title`).
5. **Given** one or more items fail to publish, **Then** the system shows a per-item error
   message, leaves successfully created items untouched, and shows a "Retry failed items" button
   for the failed ones.
6. **Given** the reviewer clicks "Publish to GitHub Projects" a second time on an already-
   published session, **Then** the system detects existing issue IDs in the session record and
   shows them without creating duplicates.
7. **Given** no GitHub Projects connection is configured, **When** the reviewer reaches the
   publish step, **Then** only the MVP1 local JSON download button is shown with a prompt to
   configure GitHub Projects for direct publish.

---

### User Story 4 — Import GitHub Projects Context via `/speckit-import-backlog` (Priority: P2)

A developer running the speckit authoring workflow uses `/speckit-import-backlog` before
`/speckit-specify` to pull current project items from a configured GitHub Projects board into the
active feature directory as `backlog-context.json`. The skill reads the GitHub MCP server config
from `.claude/mcp.json`, fetches items for the specified owner and project number, writes
structured JSON to the feature directory, and appends a reference to the context file in the
feature's `spec.md` Assumptions section.

**Why this priority**: Developer-workflow improvement — enriches spec authoring but does not block
the in-app P1 features (US1–US3). P2 because it depends on the MCP config being in place.

**Independent Test**: With `.claude/mcp.json` configured with the GitHub MCP server and a valid
`GITHUB_TOKEN` in the environment, run `/speckit-import-backlog --owner myorg --project 5`. Verify:
(1) `specs/[NNN]-[feature]/backlog-context.json` is created with a list of items containing
title, status, and priority; (2) the active feature's `spec.md` Assumptions section references
the context file; (3) re-running the skill overwrites the file with a refresh timestamp.

**Acceptance Scenarios**:

1. **Given** `.claude/mcp.json` contains a valid GitHub MCP server entry and `GITHUB_TOKEN` is
   set, **When** the developer runs `/speckit-import-backlog --owner [org] --project [number]`,
   **Then** existing project items are fetched and written to
   `specs/[NNN]-[feature]/backlog-context.json` as a structured JSON array.
2. **Given** the import completes, **Then** the skill reports the item count and the output file
   path, and appends a reference in the active feature's `spec.md` Assumptions section.
3. **Given** the MCP server is unreachable or the token is invalid, **When** the skill runs,
   **Then** it exits with a clear error message and does not create a partial context file.
4. **Given** the project has no items, **When** the skill runs, **Then** it creates an empty
   context file and reports zero items — no error is raised.
5. **Given** `backlog-context.json` already exists, **When** the skill runs again, **Then** it
   overwrites the file and includes a `fetchedAt` timestamp in the output — no confirmation prompt.

---

### Edge Cases

- What if the GitHub PAT has `repo` scope but not `project` scope? → System displays a clear
  "Insufficient token permissions — project scope required" error; reviewer is shown the required
  scope list and `.env.example` reference.
- What if the GitHub Projects board contains items from multiple repositories? → All items are
  fetched and included; their repository origin is preserved in the `backlog-context.json` and
  used in overlap display ("Existing overlap — [item title] (from [repo])").
- What if the MCP subprocess crashes mid-session? → The NestJS backend detects the process exit,
  surfaces a "GitHub connection lost — please restart the app" message, re-enables the JSON
  fallback for the current session, and does not attempt an automatic restart.
- What if the reviewer publishes stories referencing a repository they don't have write access to?
  → The MCP server returns a 403 for each failed issue; the system surfaces per-item "Permission
  denied" errors and allows retry after the reviewer reconfigures the token.
- What if GitHub's sub-issues API is unavailable for the target repository? → Tasks are created
  as regular GitHub Issues with the parent story number in the title prefix (e.g.,
  "[US#42] Task title") and added to the project board; the reviewer is informed of the fallback.
- What if the reviewer configures a private repository but the token lacks `repo:private` scope?
  → Same as the insufficient-scope scenario above — clear error, no partial state.
- What if `GITHUB_TOKEN` is rotated while the app is running? → The MCP subprocess holds the old
  token; token refresh requires an app restart. The reviewer is informed of this limitation in
  the setup guide.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST spawn the `@github/github-mcp-server` npm package as a local
  subprocess using stdio transport when `GITHUB_TOKEN` is present and valid in `.env`. The
  subprocess MUST be terminated cleanly when the NestJS backend shuts down.
- **FR-002**: `GITHUB_TOKEN` MUST be stored exclusively in a local `.env` file using standard
  KEY=VALUE format. The file MUST be excluded from the packaged `backlog-assistant.exe` and from
  version control via `.gitignore`. The token value MUST NOT appear in any AI model API call
  payload, SSE event, or session audit log entry.
- **FR-003**: The system MUST expose `GET /api/github-projects/status` — returns the current
  connection status, project name, and item count when connected, or error details when not.
- **FR-004**: The system MUST expose `POST /api/github-projects/configure` — accepts GitHub owner
  (org or user) and project number; validates the connection via the MCP server; stores the
  configuration in the active session.
- **FR-005**: When a GitHub Projects connection is active, the system MUST automatically fetch
  existing project items (up to 200, most-recently-updated first) during analysis and use them as
  read-only AI context, replacing the optional JSON file upload for backlog context.
- **FR-006**: When live item count exceeds 200, the system MUST use the 200 most-recently-updated
  items and display a "Context limited to 200 most-recent items" notice in the progress indicator.
- **FR-007**: The system MUST display a visible "GitHub Projects" step in the analysis progress
  indicator when a live connection is active — e.g., "Fetching GitHub Projects context…".
- **FR-008**: When the GitHub MCP server fails or times out during analysis, the system MUST
  surface a clear connection failure message and fall back to the MVP1 JSON file upload flow
  without interrupting the session.
- **FR-009**: When a GitHub Projects connection is active, the system MUST hide the optional JSON
  file upload field on the input page and show a "Using live GitHub Projects context" notice.
- **FR-010**: Before any GitHub API publish call, the system MUST present a confirmation modal
  listing all items to be created and require explicit reviewer confirmation — consistent with
  Constitution Principle I (Human Oversight).
- **FR-011**: The system MUST create approved user stories as GitHub Issues with: title,
  description, acceptance criteria in the issue body, a `priority:high/medium/low` label, and a
  category label. Issues MUST be added to the configured GitHub Projects board.
- **FR-012**: The system MUST create approved tasks as GitHub Issues linked to their parent story
  issue. The system MUST attempt to use GitHub's sub-issues API; if unavailable, it MUST fall back
  to prefixing the task issue title with the parent story issue number (e.g., "[US#42] Task title").
- **FR-013**: After successful publish, the system MUST display the GitHub issue number and a
  direct link for each created item in the session view.
- **FR-014**: The system MUST implement publish idempotency — if a session item already has a
  recorded GitHub issue ID, re-publishing MUST return the existing issue ID rather than creating
  a duplicate.
- **FR-015**: The system MUST show per-item publish failures with the error reason and a "Retry"
  button; retrying MUST only attempt failed items and MUST NOT re-create already-created items.
- **FR-016**: When no GitHub Projects connection is configured, the publish step MUST show only
  the MVP1 JSON download button with a prompt to configure a connection.
- **FR-017**: The `/speckit-import-backlog` Claude Code skill MUST be updated to use the GitHub
  MCP server defined in `.claude/mcp.json` — it MUST accept `--owner` and `--project` arguments,
  fetch project items, write `specs/[NNN]-[feature]/backlog-context.json`, and update the active
  `spec.md` Assumptions section.
- **FR-018**: `.claude/mcp.json` MUST define the GitHub MCP server entry with stdio transport,
  reading `GITHUB_PERSONAL_ACCESS_TOKEN` from the local environment. This configuration is for
  Claude Code skills only and is separate from the app's internal MCP client.
- **FR-019**: The NestJS backend MUST expose `GET /api/github-projects/boards` — returns a list
  of GitHub Projects accessible to the configured token, for use in the settings UI selector.
- **FR-020**: The system MUST provide a dedicated **Backlog** screen at the `/backlog` route
  reachable via a top-level navigation link always visible in the app header. When a GitHub
  Projects connection is active, the screen MUST display a read-only list of up to 200 project
  items sorted by most-recently-updated. This is the top-priority UI addition for this feature.
- **FR-021**: The NestJS backend MUST expose `GET /api/github-projects/items` — fetches up to 200
  project items for the configured project and returns them as a structured list (issueNumber,
  title, status, priority, labels, updatedAt, repositoryName, body).
- **FR-022**: The Backlog screen MUST display per-item: issue number, title, status badge, priority,
  all labels, and last-updated date. Clicking a row MUST expand the item inline to show the full
  issue body (description). No editing controls are present.
- **FR-023**: The Backlog screen MUST include a real-time keyword search field that filters visible
  items by title match. Clearing the field restores the full list without a new API call.
- **FR-024**: The Backlog screen MUST include filter controls for status (Open / Closed / In
  Progress / All) and priority (High / Medium / Low / All) that narrow the visible list client-side.
- **FR-025**: The Backlog screen MUST include a "Refresh" button that re-calls
  `GET /api/github-projects/items` and updates the list; a loading indicator MUST be shown during
  the fetch. When no connection is configured, the screen MUST show a "No GitHub Projects
  connected" empty state with a link to the Settings configuration page.

### Key Entities

- **GitHubProjectsConnection**: A configured link to a GitHub Projects board. Key attributes:
  `owner` (org or user), `projectNumber` (integer), `projectName` (string), `repoOwner`,
  `repoName`, `status` (`active` | `error` | `unconfigured`). Token is referenced by name from
  `.env` — never stored in this entity.
- **GitHubProjectItem**: An existing item fetched from the connected project for read-only AI
  context. Key attributes: `issueNumber`, `title`, `body`, `status`, `priority`, `labels[]`,
  `updatedAt`, `repositoryName`.
- **GitHubPublishResult**: The outcome of a single item's publish action. Key attributes:
  `internalItemId`, `githubIssueNumber`, `githubIssueUrl`, `status` (`created` | `failed` |
  `skipped`), `errorMessage`, `retryEligible`.
- **GitHubPublishSession**: The aggregate publish outcome for a session. Key attributes:
  `publishTimestamp`, `projectOwner`, `projectNumber`, `repoOwner`, `repoName`, `results[]`
  (list of `GitHubPublishResult`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer with `GITHUB_TOKEN` set completes the full analysis workflow (submit →
  live context fetch → results display) within the same 60-second window from MVP1 SC-010 —
  verified across 10 test submissions with an active GitHub Projects connection.
- **SC-002**: 100% of publish actions to GitHub Projects require explicit reviewer confirmation
  before any API call — verified across all test publish sessions.
- **SC-003**: A reviewer configures a GitHub Projects connection and completes their first
  live-context analysis in under 5 minutes from token setup to results displayed.
- **SC-004**: `/speckit-import-backlog` fetches and writes live project context for a board with
  up to 100 items in under 30 seconds — measured across 5 test runs.
- **SC-005**: Zero duplicate GitHub Issues are created across repeated publish runs on the same
  session — verified by inspecting the GitHub repository after 3+ publish attempts.
- **SC-006**: Token values are confirmed absent from all AI model API call payloads — verified by
  inspecting request content across 5 test analysis and publish sessions.
- **SC-007**: When the GitHub MCP server is unreachable, the system falls back to JSON upload and
  displays a failure message within 5 seconds — verified across 5 simulated failure scenarios.
- **SC-008**: GitHub Issues created during publish contain the correct labels, acceptance criteria
  in the body, and appear on the configured GitHub Projects board — verified across 10 published
  sessions.
- **SC-009**: The Backlog screen renders up to 200 items within 5 seconds of opening when a GitHub
  Projects connection is active — verified across 5 test loads with projects of 50, 100, and 200+
  items.
- **SC-010**: Keyword search on the Backlog screen filters visible results within 200ms per
  keystroke for lists of up to 200 items — client-side filtering, no additional API call required.

## Assumptions

- This feature supersedes `003-mcp-custom-skills`. Jira Cloud, Linear, and Azure DevOps
  integrations are deferred to a future release. The MVP1 JSON upload fallback remains intact.
- The GitHub Personal Access Token (classic) must have `project` (read/write) and `repo` (or
  `public_repo` for public repositories) scopes. Fine-grained PATs are not supported in MVP due
  to GitHub Projects permission model complexity.
- The `@github/github-mcp-server` npm package is used as the local MCP server. It is launched
  via `npx -y @github/github-mcp-server stdio` by the NestJS backend process.
- GitHub Projects v2 is the only supported project type. Classic GitHub Projects (v1) are not
  supported.
- The reviewer is responsible for provisioning their own PAT. The system does not manage token
  provisioning, rotation, or expiry.
- Token rotation requires an app restart; the system does not support hot-reload of credentials.
- GitHub's sub-issues API (available to repositories enrolled in the sub-issues beta) is the
  preferred task-linking mechanism; the title-prefix fallback is used when the API returns a 422.
- Issues are created in a single repository specified in the configuration (not split across
  multiple repositories). Multi-repository publish is post-MVP.
- Rate limiting by GitHub's API is the reviewer's responsibility for this release; no automatic
  retry-with-backoff is implemented. A clear rate-limit error message is surfaced per item.
- The `@github/github-mcp-server` npm package, the MCP SDK packages, and all related dev
  dependencies are installed in the Nx workspace but are NOT bundled into `backlog-assistant.exe`.
  They run from the local `node_modules/` directory at runtime.
- The `.claude/mcp.json` GitHub MCP server entry is for Claude Code CLI skills only; it is NOT
  the same as the NestJS internal MCP client subprocess. Both use the same npm package but with
  independent process lifecycles.
- Multi-user sessions writing to the same GitHub repository concurrently are out of scope;
  the single-reviewer model from MVP1 is unchanged.
