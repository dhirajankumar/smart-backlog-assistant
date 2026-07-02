# Quickstart & Validation Guide: AI-Backed Backlog Refinement — MVP1

**Date**: 2026-07-01 | **Feature**: [spec.md](./spec.md)

This guide covers prerequisites, local development setup, end-to-end validation scenarios,
and how to build the portable Windows demo executable.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or later | Required for Nx + NestJS + Angular CLI |
| npm | 10+ | Bundled with Node.js 20 |
| Nx CLI | latest | `npm install -g nx` |
| Anthropic API key | — | Set as `ANTHROPIC_API_KEY` environment variable |
| pkg | latest | `npm install -g pkg` — required only for building the demo exe |

**Windows demo machine** (client-facing): No prerequisites — the distributed
`backlog-assistant.exe` bundles Node.js. Client opens `http://localhost:3000` after running
the exe.

---

## Environment Variables

Create a `.env` file in the repo root (never commit this file):

```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

NestJS reads these via `@nestjs/config` (`ConfigModule.forRoot()`). Angular reads `PORT`
at build time via the Nx proxy config for local development.

---

## Install Dependencies

```bat
npm install
```

Nx installs dependencies for all apps and libs in the workspace.

---

## Local Development

Run NestJS backend and Angular frontend concurrently (two terminals or one with `--parallel`):

```bat
:: Terminal 1 — NestJS API on :3000
npx nx serve api

:: Terminal 2 — Angular dev server on :4200 (proxied to :3000 for /api)
npx nx serve web
```

Open `http://localhost:4200` in a browser.

**Proxy config**: `apps/web/proxy.conf.json` forwards `/api/*` to `http://localhost:3000`.
The NestJS server serves Angular static files in production; the proxy handles this in dev.

---

## Run Tests

```bat
:: All unit + integration tests (Jest)
npx nx run-many --target=test

:: API unit tests only
npx nx test api

:: Angular component tests only
npx nx test web

:: End-to-end tests (Cypress — requires both servers running)
npx nx e2e web-e2e
```

---

## Build Production Bundle

```bat
:: Build Angular (outputs to dist/apps/web/)
npx nx build web --configuration=production

:: Build NestJS (outputs to dist/apps/api/)
npx nx build api --configuration=production
```

NestJS `ServeStaticModule` serves `dist/apps/web/` at the root path in production.
Visit `http://localhost:3000` (no separate Angular server needed).

---

## Build Windows Demo Executable

```bat
:: Full pipeline: build both apps → bundle with pkg → create zip
build-demo.bat
```

Output: `dist/backlog-assistant.exe` (~60 MB, Windows x64 standalone)

**What `build-demo.bat` does**:
1. `npx nx build api --configuration=production`
2. `npx nx build web --configuration=production`
3. `pkg dist/apps/api/main.js --config pkg.config.json --output dist/backlog-assistant.exe`
4. Creates `dist/backlog-assistant-demo.zip` containing the exe and a one-page README

**Client instructions** (in the zip README):
1. Run `backlog-assistant.exe`
2. Open `http://localhost:3000` in any modern browser
3. The app is ready — no internet connection required after startup

---

## End-to-End Validation Scenarios

Run these manually (or via Cypress) to confirm the feature works end-to-end.

### Scenario 1 — Full happy path (text input)

**Setup**: Start the app. Have a 300-word requirements paragraph ready to paste.

1. Paste text into the input field. Leave the backlog JSON upload empty. Click **Analyse**.
2. **Verify**: Progress indicator shows steps: "Extracting text → Analysing requirements → Generating stories → Detecting overlaps → Complete".
3. **Verify**: Key Requirements Summary appears (≥ 2 bullets) before any story cards.
4. **Verify**: At least one draft user story appears with: title, role, benefit, ≥ 2 acceptance criteria, priority badge (High/Medium/Low), category label, confidence indicator, rationale paragraph.
5. Approve one story. **Verify**: status badge changes to **Approved**.
6. Click **Reject** on another story. Enter a reason. **Verify**: story removed from the active queue.
7. Click **Edit** on a third story. Change the priority to **High**. Save. **Verify**: badge shows **Amended — Approved**; original AI text is visible in the audit trail tooltip.
8. Navigate to the approved story's tasks. **Verify**: tasks are generated on-demand (a loading state appears, then task cards).
9. Approve two tasks, reject one.
10. Click **Publish**. Enter your name (optional). Click **Confirm**.
11. **Verify**: A JSON file downloads containing only approved/amended stories and tasks.
12. **Verify**: `auditLog` in the JSON contains entries for all Approve, Reject, Amend actions with ISO-8601 timestamps.
13. **Verify**: The rejected story and rejected task are absent from `userStories[]`.

---

### Scenario 2 — PDF input with existing backlog

**Setup**: Prepare a 2-page text-based PDF and a JSON file of 10 existing backlog items
(array of objects with `title` and optional `description`).

1. Upload the PDF. Upload the backlog JSON. Click **Analyse**.
2. **Verify**: Progress indicator shows "Validating backlog" step.
3. **Verify**: Any generated story matching an existing item title (similarity ≥ 0.6) shows an **"Existing overlap"** badge naming the matched item.
4. Complete the review and publish. **Verify**: overlap flags appear in the export JSON.

---

### Scenario 3 — Feedback and regeneration

1. On a draft story, click **Feedback**. Enter: "Add a scenario for mobile users."
2. Click **Regenerate**. **Verify**: A new draft story replaces the original; the new story retains the structured format (title, role, benefit, acceptance criteria, priority, category, confidence, rationale).
3. **Verify**: A `Regenerate` action appears in the audit log for that story ID.

---

### Scenario 4 — Error handling

**Image-only PDF**:
1. Upload a scanned (image-only) PDF. Click **Analyse**.
2. **Verify**: Error message: "This PDF appears to be image-based and cannot be read. Please paste the text manually or use a text-based PDF." No crash.

**Invalid backlog JSON**:
1. Upload a JSON file that is not an array (e.g., `{"key": "value"}`). Click **Analyse**.
2. **Verify**: Error message references the expected schema: "array of objects each with a `title` field."

**Zero approved stories at publish**:
1. Reject all stories. Click **Publish**.
2. **Verify**: Publish button is disabled or shows an inline error: "At least one approved story is required to publish."

---

### Scenario 5 — Session state (browser-only)

1. Begin analysis and approve one story.
2. Close the browser tab. Reopen the app.
3. **Verify**: No session data is restored. The app starts fresh at the input screen.

---

## Validating the Export JSON

The export file `backlog-export-<id>-<timestamp>.json` must satisfy:

- `exportVersion` is `"1.0.0"`
- `model` matches `MODEL_ID` (`"claude-sonnet-4-6"`)
- `promptVersions` is a non-empty object with string version values
- `userStories[]` contains only items with `status: "Approved" | "Amended"`
- Every `userStory.tasks[]` contains only `status: "Approved" | "Amended"` items
- `auditLog[]` contains at least one entry for every story/task that was approved
- `reviewerName` is a string or `null`
- No `status: "Draft"` or `status: "Rejected"` items appear anywhere in `userStories`

Reference: [data-model.md](./data-model.md#publishedbacklog), [contracts/api-routes.md](./contracts/api-routes.md#post-apiexport)
