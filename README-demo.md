# Smart Backlog Assistant — Demo

## Before You Start

Anthropic access is provisioned by your organisation — no personal API key is required. The app uses your active Anthropic SSO session.

### Step 1 — Install Node.js (required for GitHub integration)

The main app is a self-contained exe, but the GitHub MCP server (used for publishing stories to GitHub Projects) is a JavaScript process that requires **Node.js 22** on your PATH.

Check whether Node is already installed:

```cmd
node --version
```

If the command is not found or the version is below 22, install it:

```cmd
winget install OpenJS.NodeJS.LTS
```

Restart your terminal after installation so `node` is available on PATH. If `winget` is not available on your machine, download the installer from [nodejs.org](https://nodejs.org) and choose the **LTS** release.

> The GitHub integration is optional. If you skip this step the app starts normally; only the "Publish to GitHub Projects" feature will be unavailable.

### Step 2 — Authenticate (one-time setup)

If you have not already authenticated on this machine, open **Command Prompt** or **PowerShell** and run:

```cmd
claude auth login
```

Follow the browser prompt to complete the SSO login. Credentials are stored in your local profile and are picked up automatically when the app starts.

### Step 3 — Run the App

Double-click **`backlog-assistant.exe`** — no terminal needed.

Once the console window appears and shows `Server running`, open your browser and go to:

```
http://localhost:3000
```

> This URL loads the **UI** (the Angular web app). The backend API runs on the same port under `/api/` — you never need to open that directly.

---

## Usage

### 1. Submit Requirements

- **Paste Text or JSON** — paste a plain-text requirements document into the textarea.
- **Upload PDF** — upload a text-based PDF (max 10 MB). Scanned/image PDFs are not supported.

Click **Analyse Requirements** to start. Stories stream in as they are generated.

### 2. Review Stories

Each generated user story appears on the Review page as a card. For each story you can:

| Action | What it does |
|---|---|
| **Approve** | Marks the story accepted; it will be included in the export |
| **Reject** | Removes the story; you can optionally supply a rejection reason |
| **Amend** | Edit the story title, role, benefit, acceptance criteria, priority, or category inline |
| **Regenerate** | Provide written feedback and request a fresh AI draft of the story |

An optional **Reviewer note** field at the top of the page lets you attach a summary comment to the entire review session.

Once at least one story is approved, the **Proceed to Tasks** button becomes available.

### 3. Review Tasks

For each approved story, the AI generates a set of implementation tasks. Tasks go through the same Approve / Reject / Amend / Regenerate workflow as stories.

### 4. Publish

When all stories and tasks are reviewed, download a structured JSON export containing:
- Approved user stories with full metadata
- Approved tasks linked to their parent stories
- Rejection reasons and amendment history (audit log)
- Reviewer note

---

## Sample Input

### Requirements text (paste into the textarea)

```
We are building an online task management application for small teams.

1. Users should be able to register with email and password.
2. Users should be able to create projects and invite team members.
3. Team members should be able to create, assign, and complete tasks within a project.
4. Tasks should support priority levels: Low, Medium, High, Critical.
5. Users should receive email notifications when a task is assigned to them.
6. A dashboard should show each user's open tasks sorted by due date.
7. Project managers should be able to export task reports as CSV.
8. The system must support concurrent users without data loss (target: 100 concurrent users).
```

### Existing backlog JSON

```json
[
  {
    "title": "User registration and login",
    "description": "Basic auth with email/password",
    "priority": "High",
    "category": "Authentication"
  },
  {
    "title": "Task creation",
    "description": "Allow users to create tasks inside a project",
    "priority": "High",
    "category": "Core Features"
  },
  {
    "title": "Email notifications",
    "description": "Send emails on task assignment",
    "priority": "Medium",
    "category": "Notifications"
  }
]
```

---

## Building the Demo Package (developers only)

### Prerequisites

- Node.js 22 (LTS)
- `pkg` installed globally: `npm install -g pkg`
- All npm dependencies installed: `npm ci`

### Build steps

```cmd
build-demo.bat
```

This script runs four steps:

| Step | What it does |
|---|---|
| 1 | `nx build api --configuration=production` — compiles the NestJS API |
| 2 | `nx build web --configuration=production` — compiles the Angular frontend |
| 3 | `pkg dist/apps/api/main.js --config pkg.config.json` — bundles the API into a Windows x64 standalone exe (Node 22, ~60 MB) |
| 3.5 | Copies Angular static files to `dist/web/browser/` alongside the exe |
| 3.6 | Copies `node_modules/github-mcp-server` to `dist/github-mcp-server/` so the MCP server is self-contained in the zip |
| 4 | Zips `backlog-assistant.exe`, `dist/web/`, `dist/github-mcp-server/`, and `README-demo.md` into `dist/backlog-assistant-demo.zip` |

The final artefact is `dist/backlog-assistant-demo.zip`. The zip must be distributed as-is — `dist/web/browser/` and `dist/github-mcp-server/` must stay next to the exe at runtime.

### pkg configuration (`pkg.config.json`)

```json
{ "targets": ["node22-win-x64"] }
```

---

## Notes

- Session data is stored in the browser only — closing the tab clears all state.
- No internet connection is required after the app starts (only the Anthropic API call needs outbound access).
- To stop the app, close the console window.
- The Regenerate feature calls the `/api/regenerate` endpoint with your feedback and the original story/task; it streams a replacement item in the same SSE format as the initial analysis.
