# Feature Specification: MCP Integration and Custom Skills — MVP2

**Feature Branch**: `003-mcp-custom-skills`

**Created**: 2026-07-01

**Last Updated**: 2026-07-01

**Status**: Draft

**Input**: User description: "MVP2: MCP Integration and Custom Skills — extend the Smart Backlog
Assistant with live backlog system connectivity and custom Claude Code skills. Key capabilities:
(1) MCP tool integration inside the NestJS app so Claude can call live Jira, Linear, and GitHub
Issues during analysis — replacing the JSON file upload for backlog context; (2) direct publish
via MCP tool_use to push approved stories and tasks to external systems; (3) three new Claude
Code speckit skills: /speckit-publish-to-jira, /speckit-import-backlog, /speckit-prompt-tune;
(4) MCP server config for Claude Code (.claude/mcp.json); (5) credential management via local
.env file excluded from packaging; (6) constitution compliance: Human Oversight and Privacy
principles."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Live Backlog Context During Analysis (Priority: P1)

A reviewer opens the Smart Backlog Assistant, selects a connected external backlog system
(Jira, Linear, or GitHub Issues), and submits their requirements document for analysis. The AI
automatically queries the configured system for existing backlog items and uses them as read-only
context — no manual JSON export or file upload required. Overlap detection against live items
works exactly as in MVP1, but the data source is now live.

**Why this priority**: This removes the highest-friction step in the MVP1 workflow — exporting a
backlog JSON file before each session. It is the primary value unlock of MVP2 and unblocks all
downstream improvements. Without live context, none of the other MVP2 capabilities deliver their
full value.

**Independent Test**: Configure a Jira connection with a valid project key. Submit a two-page
requirements PDF for analysis without uploading any JSON file. Verify that the Key Requirements
Summary and AI-generated stories appear, that at least one story flags an existing Jira item as
"Existing overlap", and that no file upload prompt is shown when a live connection is active.

**Acceptance Scenarios**:

1. **Given** a backlog system connection is configured and active, **When** the reviewer submits
   input for analysis, **Then** the system queries the connected system for existing items and
   uses them as read-only context — the optional JSON upload field is hidden or disabled.
2. **Given** the live backlog query returns items, **When** analysis completes, **Then** overlap
   detection works against live items exactly as it does against uploaded JSON in MVP1, surfacing
   "Existing overlap" flags with the matching item's title.
3. **Given** the live backlog system is unreachable at analysis time, **When** the reviewer
   submits input, **Then** the system displays a clear connection failure message and falls back
   to the MVP1 JSON file upload option so the session can continue.
4. **Given** a connection is active but the project/board returns zero items, **When** analysis
   completes, **Then** no overlap checks are run and no warning is shown — matching MVP1 behavior
   for an empty backlog JSON.
5. **Given** the live query returns more than 200 existing items, **When** analysis runs, **Then**
   the system uses the most recently updated 200 items as context and informs the reviewer that
   the backlog was truncated for performance.

---

### User Story 2 — Publish Approved Items Directly to an External System (Priority: P1)

After completing the review workflow, a reviewer clicks "Publish to [System]" and their approved
user stories and tasks are created directly in the configured Jira project, Linear team, or
GitHub repository — no local JSON file is required. Each created item is linked back in the
session so the reviewer can see the external issue ID alongside the story they approved.

**Why this priority**: Co-P1 with live context because together they close the loop: live context
coming in, live publish going out. Without direct publish, reviewers still face a manual copy-paste
step into their backlog system after every session, which eliminates most of the workflow value.

**Independent Test**: Complete a full review session (approve at least two stories, each with at
least one approved task). Click "Publish to Jira". Verify that Jira issues are created with the
correct hierarchy (epic → story → subtask), that rejected items are absent, and that the session
shows the Jira issue ID for each created item.

**Acceptance Scenarios**:

1. **Given** at least one approved story is in the publish queue, **When** the reviewer clicks
   "Publish to [System]", **Then** the system presents a confirmation summary listing the items
   to be created before any external API call is made.
2. **Given** the reviewer confirms the publish action, **Then** approved stories are created in
   the external system as the appropriate item type (Jira story/epic, Linear issue, GitHub issue),
   and their linked approved tasks are created as child items or subtasks.
3. **Given** the publish succeeds, **When** the reviewer views the session, **Then** each
   published item shows the external system's issue ID as a reference link.
4. **Given** one or more items fail to publish (API error, permission denied), **Then** the
   system surfaces a per-item failure message, leaves successful items created, and allows the
   reviewer to retry failed items individually.
5. **Given** no backlog system connection is configured, **When** the reviewer reaches the publish
   step, **Then** the system falls back to the MVP1 local JSON download as the only publish
   option, with a prompt to configure a connection for future sessions.
6. **Given** the reviewer clicks "Publish to [System]" with zero approved stories, **Then** the
   system prevents the publish action — consistent with the MVP1 guard.

---

### User Story 3 — Import Live Backlog Context via `/speckit-import-backlog` (Priority: P2)

A developer running the speckit authoring workflow uses `/speckit-import-backlog` before
`/speckit-specify` to pull the current state of a project's backlog from Jira, Linear, or GitHub
Issues into the feature directory as a structured context file. This gives the AI background
awareness of existing work when generating the spec.

**Why this priority**: This is a developer-workflow capability, not an end-user app feature. It
enriches the spec authoring experience but does not block MVP2 from delivering its primary app
value (Stories 1 and 2). P2 because it depends on the MCP server configuration being in place.

**Independent Test**: With `.claude/mcp.json` configured for Jira, run `/speckit-import-backlog`
with a project key. Verify that a `backlog-context.json` file is created under the active feature
directory, containing a structured list of existing items with their titles, statuses, and
priorities. Verify that the file is referenced in the feature's `spec.md` under Assumptions.

**Acceptance Scenarios**:

1. **Given** `.claude/mcp.json` is configured with a valid Jira/Linear/GitHub connection,
   **When** the developer runs `/speckit-import-backlog [project-key]`, **Then** existing
   backlog items are fetched and written to `specs/[NNN]-[feature]/backlog-context.json`.
2. **Given** the import completes successfully, **Then** the skill reports the count of items
   retrieved and the file path created, and appends a reference to the context file in the active
   feature's `spec.md` Assumptions section.
3. **Given** the external system is unreachable or credentials are invalid, **When** the skill
   runs, **Then** it exits with a clear error message identifying the connection failure and does
   not create a partial context file.
4. **Given** the project/board has no items, **When** the skill runs, **Then** it creates an
   empty context file and reports zero items retrieved — no error is raised.

---

### User Story 4 — Push a Published Backlog to Jira via `/speckit-publish-to-jira` (Priority: P2)

A developer uses `/speckit-publish-to-jira` after running `/speckit-implement` or after a
reviewer has exported a `PublishedBacklog` JSON. The skill reads the published artifact and
creates corresponding Jira epics, stories, and subtasks, then reports the created issue IDs.

**Why this priority**: Complements the in-app direct publish (Story 2) for teams who prefer to
manage publishing from the CLI rather than the app UI. P2 because the in-app publish path (Story
2) already covers the primary workflow.

**Independent Test**: With a valid `PublishedBacklog` JSON from a completed session, run
`/speckit-publish-to-jira --feature 001`. Verify Jira issues are created with the correct
epic → story → subtask hierarchy, that rejected items are absent from the created set, and that
the skill outputs the Jira issue ID for each created item.

**Acceptance Scenarios**:

1. **Given** a `PublishedBacklog` JSON exists for the specified feature, **When** the developer
   runs `/speckit-publish-to-jira --feature [NNN]`, **Then** the skill reads the artifact and
   creates Jira issues matching the approved stories and tasks.
2. **Given** the publish completes, **Then** the skill writes a `jira-publish-result.json` to
   the feature directory mapping each internal story/task ID to its created Jira issue key.
3. **Given** a Jira issue creation fails for one item, **Then** the skill continues creating
   remaining items, reports the failed item with its error, and allows re-running the skill to
   retry only failed items.
4. **Given** the skill is run again on a feature already published to Jira, **Then** it detects
   existing issues via the `jira-publish-result.json` map and skips already-created items rather
   than creating duplicates.

---

### User Story 5 — Improve Prompt Quality via `/speckit-prompt-tune` (Priority: P3)

A developer runs `/speckit-prompt-tune` after accumulating several completed session audit logs.
The skill reads the logs alongside the prompt files in `docs/prompts/`, analyzes approval rates,
amendment patterns, and low-confidence flags, and produces a structured report with specific
improvement suggestions for each prompt version.

**Why this priority**: Quality improvement tooling — valuable but has no dependency on the core
P1/P2 MVP2 features. Requires at least three completed sessions to generate meaningful data, so
it is naturally sequenced as a post-stabilization addition.

**Independent Test**: With at least three completed session audit log files present, run
`/speckit-prompt-tune`. Verify that a `prompt-tune-report.md` is created in `docs/prompts/`,
that it references each prompt file by version, and that it contains at least one specific
actionable suggestion (not a generic observation) per prompt analyzed.

**Acceptance Scenarios**:

1. **Given** at least three session audit logs exist and prompt files are present in
   `docs/prompts/`, **When** the developer runs `/speckit-prompt-tune`, **Then** a
   `prompt-tune-report.md` is created with per-prompt quality metrics and suggestions.
2. **Given** the report is generated, **Then** each prompt section includes: the prompt version
   analyzed, approval rate (%), amendment rate (%), low-confidence rate (%), and at least one
   specific improvement suggestion.
3. **Given** fewer than three session audit logs are available, **When** the skill runs,
   **Then** it exits with a clear message stating the minimum data requirement and the count of
   available logs.
4. **Given** the skill is run again after new sessions complete, **Then** it appends a new
   dated report section rather than overwriting previous results.

---

### Edge Cases

- What happens when a reviewer has both a live connection configured and uploads a JSON file?
  The live connection takes precedence; the JSON file is ignored and the reviewer is informed.
- What if the external system returns items but the API response exceeds the AI context budget?
  The system uses the most recently updated items up to the context limit and informs the reviewer
  how many items were included vs. truncated.
- What if credential tokens expire mid-session during a live publish?
  The system surfaces a token expiry error per item and prompts the reviewer to reconnect; partial
  publishes are reported clearly so the reviewer knows which items were and were not created.
- What happens when the same story is published twice to the same system (accidental double-click
  or re-run)?
  The system detects the already-created issue ID in the session record and prevents duplicate
  creation, showing the existing issue ID instead.
- What if the external system's issue schema does not support one of the fields in the published
  backlog (e.g., GitHub Issues has no priority field)?
  Unsupported fields are mapped to the closest available field or appended to the item description;
  no data is silently dropped.
- What happens when `/speckit-import-backlog` is run on a feature directory that already has a
  `backlog-context.json`?
  The skill overwrites the existing file and notes the refresh timestamp in the output; no prompt
  is shown for confirmation since this is a development-side operation.
- What if the `.env` credential file is missing or malformed when the reviewer attempts analysis
  or publish?
  The system displays a setup guide message explaining the expected `.env` format and falls back
  to JSON file upload for analysis; publish to external system is disabled until credentials are
  valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a reviewer to configure a connection to at least one external
  backlog system (Jira Cloud, Linear, or GitHub Issues) by providing an API token and
  project/board identifier stored in a local credential file that is excluded from the packaged
  executable and from version control.
- **FR-002**: When a backlog system connection is active and valid, the system MUST automatically
  query the connected system for existing backlog items during analysis and use them as read-only
  context, eliminating the need for a manual JSON file upload.
- **FR-003**: Live backlog items retrieved from an external system MUST be used for read-only AI
  context and overlap detection only — the system MUST NOT write to or modify any item in the
  external system during the analysis phase.
- **FR-004**: When a live connection is active, the system MUST cap the number of items fetched
  at 200 (most recently updated first) and inform the reviewer if the backlog was truncated.
- **FR-005**: When the external system is unreachable or returns an error during analysis, the
  system MUST surface a clear connection failure message and fall back to the MVP1 JSON file
  upload flow without interrupting the session.
- **FR-006**: The system MUST support direct publish of approved user stories and tasks to the
  configured external backlog system as the primary publish option when a connection is active,
  creating items in the correct hierarchy (epic/parent → story → subtask/child).
- **FR-007**: Before any external publish API call is made, the system MUST present a confirmation
  summary of the items to be created and require explicit reviewer confirmation — consistent with
  the Human Oversight principle.
- **FR-008**: The system MUST display per-item publish results (issue ID on success, error reason
  on failure) and allow the reviewer to retry failed items individually without republishing
  already-created items.
- **FR-009**: When no external connection is configured, the system MUST fall back to the MVP1
  local JSON download as the only publish option and prompt the reviewer to configure a connection
  for future sessions.
- **FR-010**: API credentials (tokens, endpoints) MUST be stored exclusively in a local `.env`
  file using standard KEY=VALUE pairs. This file MUST be excluded from the packaged `.exe` and
  from version control via `.gitignore`.
- **FR-011**: Credential values MUST NOT appear in any data payload sent to the AI model.
  The system MUST pass only anonymized references (e.g., system type and project key) as context.
- **FR-012**: The `/speckit-import-backlog` Claude Code skill MUST connect to a configured
  external backlog system, fetch existing items for a specified project or board, and write them
  as structured JSON to `specs/[NNN]-[feature]/backlog-context.json`.
- **FR-013**: The `/speckit-publish-to-jira` Claude Code skill MUST read a `PublishedBacklog`
  JSON artifact for a specified feature and create corresponding Jira epics, stories, and
  subtasks, reporting the created issue keys in a `jira-publish-result.json` file.
- **FR-014**: The `/speckit-publish-to-jira` skill MUST detect already-published items via
  `jira-publish-result.json` and skip them on re-runs to prevent duplicate issue creation.
- **FR-015**: The `/speckit-prompt-tune` Claude Code skill MUST analyze session audit logs and
  prompt files in `docs/prompts/`, compute per-prompt approval rate, amendment rate, and
  low-confidence rate, and output a `prompt-tune-report.md` with at least one specific,
  actionable improvement suggestion per prompt.
- **FR-016**: The `/speckit-prompt-tune` skill MUST require a minimum of three completed session
  audit logs; if fewer are available, it MUST exit with a clear message stating the data
  requirement and the count of available logs.
- **FR-017**: MCP server configurations for Claude Code skills MUST be defined in
  `.claude/mcp.json`; this configuration is separate from the app's internal MCP tool
  integration and is used exclusively in the development workflow context.

### Key Entities

- **BacklogSystemConnection**: A configured link to an external backlog system. Key attributes:
  system type (Jira/Linear/GitHub), API endpoint, project or board identifier, connection status
  (active/error/unconfigured). Credentials are referenced by name from the `.env` file — never
  stored in this entity.
- **LiveBacklogContext**: The set of existing items fetched from a connected system for a session.
  Key attributes: source system type, project key, fetch timestamp, item count, truncation flag,
  list of backlog items (title, description, priority, category — read-only).
- **ExternalPublishTarget**: The destination for a publish action. Key attributes: system type,
  project/repo key, publish timestamp, list of publish results (internal item ID → external issue
  ID, status, error reason).
- **PublishResult**: The outcome of a single item's publish action. Key attributes: internal
  story/task ID, external issue ID (on success), error message (on failure), retry eligible flag.
- **PromptTuneReport**: Output of `/speckit-prompt-tune`. Key attributes: report date, list of
  prompt analyses (prompt file reference, version, approval rate %, amendment rate %,
  low-confidence rate %, improvement suggestions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer using a live backlog connection completes the full analysis workflow
  (submit → context load → results display) within the same 60-second window defined in MVP1
  SC-010 — verified across 10 test submissions with live connections active.
- **SC-002**: 100% of approved items published to an external system receive explicit reviewer
  confirmation before any API call is made — verified across all test publish sessions.
- **SC-003**: A reviewer configures a backlog system connection and completes their first
  live-context analysis session in under 5 minutes from setup start to results displayed.
- **SC-004**: `/speckit-import-backlog` fetches and writes live backlog context for a project
  with up to 100 items in under 30 seconds — measured across 5 test runs.
- **SC-005**: `/speckit-publish-to-jira` creates correctly structured Jira issues (with
  preserved parent–child relationships) for 100% of approved items in the test set, and
  produces zero duplicate issues across repeated runs.
- **SC-006**: `/speckit-prompt-tune` produces a report with at least one specific, actionable
  suggestion per prompt file analyzed, confirmed by a human reviewer reading the output.
- **SC-007**: Credential values are confirmed absent from all AI model API call payloads —
  verified by inspecting request content in a minimum of 5 test analysis and publish sessions.
- **SC-008**: When the configured external system is unreachable, the system falls back to the
  JSON upload option and displays a connection failure message within 5 seconds.

## Assumptions

- MVP2 extends MVP1 without removing any MVP1 capability — all MVP1 flows remain available
  as fallbacks when no external connection is configured.
- Supported external systems for MVP2: Jira Cloud, Linear, and GitHub Issues. On-premise Jira
  Server/Data Center is out of scope; it may be added in a future release.
- The reviewer is responsible for provisioning their own API token with the necessary permissions
  (read access for context queries, write access for publish). The system does not manage token
  provisioning, rotation, or expiry.
- Token rotation and expiry handling are out of scope for MVP2; when a token expires, the
  reviewer reconfigures the `.env` file and restarts the session.
- The `.env` file uses standard KEY=VALUE pairs and is co-located with the packaged executable.
  A `.env.example` file with placeholder keys is included in the distribution.
- The `/speckit-import-backlog`, `/speckit-publish-to-jira`, and `/speckit-prompt-tune` skills
  are Claude Code CLI tools used in the development workflow; they are not features of the
  packaged `backlog-assistant.exe` and are not visible to end users of the app.
- MCP server packages (`@modelcontextprotocol/server-*`) are installed as dev dependencies in
  the Nx workspace and are not bundled into the `.exe`.
- External system API schemas are consumed as-is; the system maps fields to the best available
  equivalent when a one-to-one match does not exist. Unsupported fields are appended to the
  item description rather than silently dropped.
- Rate limiting by external systems is the reviewer's responsibility for MVP2; no automatic
  retry-with-backoff is implemented.
- `/speckit-prompt-tune` requires a minimum of three completed session audit logs. This threshold
  is a product assumption — below three sessions, statistical patterns are not meaningful.
- Multi-user backlog sync (concurrent sessions writing to the same external project) is out of
  scope for MVP2; the single-reviewer model from MVP1 is unchanged.
- The in-app direct publish (User Story 2) and the `/speckit-publish-to-jira` skill (User Story
  4) are two independent paths to the same outcome; both are included to support app-UI and
  CLI-workflow reviewers respectively.
