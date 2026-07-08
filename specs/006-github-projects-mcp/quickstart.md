# Quickstart: GitHub Projects Backlog Integration

**Feature**: 006-github-projects-mcp
**Date**: 2026-07-07

This guide validates the end-to-end GitHub Projects integration — from token setup through
live-context analysis to direct publish on the GitHub Projects board. Run each scenario in order;
each depends on the previous succeeding.

---

## Prerequisites

- `backlog-assistant.exe` built and accessible (or `nx serve` for dev mode)
- A GitHub Personal Access Token (classic) with `project` and `repo` (or `public_repo`) scopes
- A GitHub Projects v2 board with at least 3 existing items in the target repository
- A target GitHub repository where test issues can be created (use a dedicated test repo)
- Node.js 18+ and npm (for running `github-mcp-server` v1.8.7 via npx)
- `.env.example` is present at the root — copy it to `.env` and populate `GITHUB_TOKEN`

---

## Setup

```bash
# 1. Set up credentials
cp .env.example .env
# Edit .env: set GITHUB_TOKEN=ghp_<your_token>

# 2. Launch the app (dev mode)
npx nx serve api &
npx nx serve web &

# OR (exe mode)
./backlog-assistant.exe
```

**Expected**: App starts. NestJS backend spawns `github-mcp-server` subprocess via stdio.
No error in backend logs. Frontend loads at `http://localhost:4200`.

---

## Scenario 1: Configure GitHub Projects Connection (US1)

**Goal**: Verify the connection configuration UI works and the status badge updates correctly.

### Steps

1. Open the app at `http://localhost:4200`.
2. Verify the header badge shows **"GitHub — Not configured"** (grey).
3. Navigate to Settings → GitHub Projects.
4. Enter: Owner = `<your-org>`, Project Number = `<your-project-number>`, Repo Owner = `<your-org>`, Repo Name = `<test-repo>`.
5. Click **"Test Connection"**.

### Expected Outcomes

- Within 5 seconds, the panel shows: **"Connected — [Project Name]"** and item count (e.g., "142 items").
- The header badge updates to **"Connected — [Project Name]"** (green).
- `GET /api/github-projects/status` returns `{ "status": "active", "projectName": "...", "itemCount": N }`.

### Failure Scenario Validation

6. Enter an invalid project number (e.g., `99999`).
7. Click **"Test Connection"**.

**Expected**: Error message "Project not found" in the panel. Badge remains "Not configured" or previous state. HTTP response is 404.

---

## Scenario 1b: Board Selector — List and Switch Projects (US1b)

**Goal**: Verify the boards dropdown populates from GitHub Projects and the connection reconfigures when a different board is selected.

### Prerequisites

- Scenario 1 complete and connection active.
- At least 2 GitHub Projects v2 boards exist under the configured owner.

### Steps

1. Navigate to Settings → GitHub Projects.
2. After the initial connection is active, click **"Browse boards"** (or the boards dropdown).
3. Observe the dropdown populates with available board names.

### Expected Outcomes

- `GET /api/github-projects/boards` returns a list of boards (name + projectNumber).
- The dropdown shows at least the currently connected board.
- Selecting a different board re-calls `POST /api/github-projects/configure` and the badge updates to the new board name.
- Selecting the same board (re-test) shows the same item count as before.

### Failure Scenario Validation

4. Temporarily revoke `project` scope from the PAT and reload the boards dropdown.

**Expected**: Error message in the panel: "Unable to list boards — check GITHUB_TOKEN scope". Existing connection remains unchanged.

---

## Scenario 2: Live Context During Analysis — Overlap Detection (US2)

**Goal**: Verify that analysis uses live GitHub Projects items as context and flags overlaps.

### Prerequisites

- Scenario 1 complete and connection active.
- At least one existing project item with a distinctive title (e.g., "Implement PDF upload endpoint").
- A requirements document (PDF or text) that references the same topic as the existing item.

### Steps

1. Navigate to the Input page.
2. Verify: **no JSON file upload field is visible**; "Using live GitHub Projects context" notice is shown.
3. Upload or paste a requirements document that includes language related to an existing project item.
4. Click **Analyse**.
5. Watch the progress indicator.

### Expected Outcomes

- Progress shows **"Fetching GitHub Projects context…"** as a distinct step before "Analysing requirements…".
- Analysis completes within 60 seconds.
- At least one AI-generated story shows **"Existing overlap — [item title]"**.
- If the project has > 200 items: progress shows **"Context limited to 200 most-recent items"**.

### Fallback Validation

6. Stop the NestJS server (or kill the MCP subprocess) and re-submit.

**Expected**: Progress shows **"GitHub connection failed — falling back to manual upload"**. The JSON upload field reappears. The session can continue with manual upload.

---

## Scenario 3: Publish Approved Items to GitHub Projects (US3)

**Goal**: Verify approved stories and tasks are created as GitHub Issues and added to the board.

### Prerequisites

- Scenario 2 complete with at least 2 approved stories, each with at least 1 approved task.
- Write access to `<test-repo>` (issues can be created).

### Steps

1. Navigate to the Publish page.
2. Verify: **"Publish to GitHub Projects"** button is visible (not just JSON download).
3. Click **"Publish to GitHub Projects"**.
4. Verify the **confirmation modal** appears, listing all items to be created (no API call yet).
5. Click **"Confirm"**.

### Expected Outcomes

- Publish results panel appears with per-item outcomes.
- Each story shows: **`#N — [story title]`** as a clickable GitHub issue link.
- Each task shows: **`#M — [task title]`** with a link, linked to its parent story.
- All created issues appear on the GitHub Projects board (verify in GitHub UI).
- GitHub issues have labels: `priority:high` / `priority:medium` / `priority:low` and the category label.
- Issue bodies include the acceptance criteria (for story issues).

### Idempotency Validation

6. Click **"Publish to GitHub Projects"** again (without changing session state).
7. Confirm the modal.

**Expected**: All items show status `skipped` with the same existing issue numbers — no duplicate issues created in GitHub.

### Partial Failure Validation

8. Temporarily revoke write permission on the test repo and publish with one new approved item.

**Expected**: New item shows `failed` status with a per-item error message and **"Retry"** button. Previously created items are unaffected.

9. Restore permissions and click **"Retry failed items"**.

**Expected**: The failed item is created; it now shows `created` with a link.

---

## Scenario 4: Import via `/speckit-import-backlog` (US4)

**Goal**: Verify the Claude Code skill fetches GitHub Projects items and writes `backlog-context.json`.

### Prerequisites

- `.claude/mcp.json` has the GitHub MCP server entry (see [contracts/github-projects-api.md](contracts/github-projects-api.md)).
- `GITHUB_TOKEN` is exported in the shell (or in `.env` loaded by your shell profile).
- Claude Code CLI (`claude`) is available.

### Steps

```bash
# Ensure the active feature is set
cat .specify/feature.json
# Should show: {"feature_directory":"specs/006-github-projects-mcp"}

# Run the import skill
claude "/speckit-import-backlog --owner <your-org> --project <project-number>"
```

### Expected Outcomes

- A file is created at `specs/006-github-projects-mcp/backlog-context.json`.
- The file contains a JSON array of objects with at least: `issueNumber`, `title`, `status`, `updatedAt`, `fetchedAt`.
- The terminal output shows the item count (e.g., "Fetched 42 items from GitHub Projects #5").
- The `spec.md` Assumptions section now references `backlog-context.json`.

### Re-run Validation

```bash
claude "/speckit-import-backlog --owner <your-org> --project <project-number>"
```

**Expected**: `backlog-context.json` is overwritten with a fresh fetch. The `fetchedAt` timestamp in the file updates. `spec.md` Assumptions reference is updated with the new timestamp.

### Error Validation

```bash
# Use an invalid project number
claude "/speckit-import-backlog --owner <your-org> --project 99999"
```

**Expected**: Error message "GitHub MCP server: project not found". No `backlog-context.json` created or modified.

---

## Cleanup

After testing, delete the GitHub issues created in the test repository:
```bash
# List test issues (created by backlog-assistant)
gh issue list --repo <your-org>/<test-repo> --label "priority:high" --json number,title
# Close/delete as needed
```

---

## References

- API contracts: [contracts/github-projects-api.md](contracts/github-projects-api.md)
- Data model: [data-model.md](data-model.md)
- Research decisions: [research.md](research.md)
- Implementation tasks: [tasks.md](tasks.md)
- `.env.example`: at repository root (co-located with `backlog-assistant.exe`)
