# API Contracts: GitHub Projects Integration Endpoints

**Feature**: 006-github-projects-mcp
**Backend**: NestJS 10, `apps/api/src/github-projects/`
**Date**: 2026-07-07

All endpoints are prefixed with `/api`. Request and response bodies use `application/json`.
Authentication to the NestJS app itself uses the existing session mechanism (not the GitHub PAT —
the GitHub PAT is stored server-side in `.env` and never returned to the client).

---

## GET /api/github-projects/status

Returns the current GitHub Projects connection status.

**Request**: No body.

**Response 200 — active connection**:
```json
{
  "status": "active",
  "owner": "myorg",
  "projectNumber": 5,
  "projectName": "Q3 Product Backlog",
  "repoOwner": "myorg",
  "repoName": "product-backend",
  "itemCount": 142
}
```

**Response 200 — not configured**:
```json
{
  "status": "unconfigured",
  "owner": null,
  "projectNumber": null,
  "projectName": null,
  "repoOwner": null,
  "repoName": null,
  "itemCount": null
}
```

**Response 200 — error state**:
```json
{
  "status": "error",
  "owner": "myorg",
  "projectNumber": 5,
  "projectName": null,
  "repoOwner": "myorg",
  "repoName": "product-backend",
  "itemCount": null,
  "errorMessage": "GitHub connection lost — please restart the app"
}
```

**Response 503** — MCP subprocess not running on startup:
```json
{
  "status": "error",
  "errorMessage": "GITHUB_TOKEN missing or invalid — see .env.example for required scopes"
}
```

**Notes**:
- Returns `200` in all cases; the `status` field distinguishes outcomes. Clients MUST check `status`, not HTTP status code.
- `itemCount` is populated during `configure` (not live-refreshed on every status call to avoid rate-limit cost).

---

## POST /api/github-projects/configure

Validates and stores the GitHub Projects configuration. Calls the GitHub MCP server to verify
the project exists and the token has sufficient permissions.

**Request body**:
```json
{
  "owner": "myorg",
  "projectNumber": 5,
  "repoOwner": "myorg",
  "repoName": "product-backend"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `owner` | string | yes | Non-empty; GitHub org or user login |
| `projectNumber` | number | yes | Positive integer |
| `repoOwner` | string | yes | Non-empty |
| `repoName` | string | yes | Non-empty |

**Response 200 — success**:
```json
{
  "status": "active",
  "projectName": "Q3 Product Backlog",
  "itemCount": 142
}
```

**Response 400 — validation error**:
```json
{
  "statusCode": 400,
  "message": ["projectNumber must be a positive number"],
  "error": "Bad Request"
}
```

**Response 404 — project not found**:
```json
{
  "statusCode": 404,
  "message": "GitHub project #5 not found for owner 'myorg'. Check the project number and token permissions.",
  "error": "Not Found"
}
```

**Response 403 — insufficient token scopes**:
```json
{
  "statusCode": 403,
  "message": "Insufficient GitHub token scopes. Required: project, repo. Visit github.com/settings/tokens to regenerate.",
  "error": "Forbidden"
}
```

**Response 503 — MCP server unavailable**:
```json
{
  "statusCode": 503,
  "message": "GitHub MCP server is not running. Ensure GITHUB_TOKEN is set in .env and restart the app.",
  "error": "Service Unavailable"
}
```

---

## GET /api/github-projects/boards

Returns a list of GitHub Projects v2 boards accessible to the configured token for the given owner.
Used to populate the project selector dropdown in the Angular settings UI.

**Query parameters**:

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `owner` | string | yes | GitHub org or user login |

**Example**: `GET /api/github-projects/boards?owner=myorg`

**Response 200**:
```json
{
  "boards": [
    { "number": 1, "title": "Engineering Roadmap" },
    { "number": 5, "title": "Q3 Product Backlog" },
    { "number": 8, "title": "Infra Improvements" }
  ]
}
```

**Response 200 — no boards found**:
```json
{
  "boards": []
}
```

**Response 400** — `owner` missing:
```json
{
  "statusCode": 400,
  "message": ["owner query parameter is required"],
  "error": "Bad Request"
}
```

**Response 503** — MCP server unavailable (same shape as configure 503 above).

---

## POST /api/github-projects/publish

Creates GitHub Issues for approved user stories and tasks, then adds them to the configured
GitHub Projects board. Implements idempotency — items with existing `githubIssueNumber` in the
session are skipped.

**CRITICAL**: The request MUST include `"confirmed": true` in the body. The endpoint MUST reject
requests without this field with `400 Bad Request`. This enforces Constitution Principle I
(Human Oversight) — no API call is made without explicit reviewer confirmation.

**Request body**:
```json
{
  "confirmed": true,
  "items": [
    {
      "internalItemId": "story-abc123",
      "type": "story",
      "title": "As a reviewer, I can submit a PDF for analysis",
      "description": "...",
      "acceptanceCriteria": ["AC1...", "AC2..."],
      "priority": "High",
      "category": "Core Workflow"
    },
    {
      "internalItemId": "task-def456",
      "type": "task",
      "parentInternalItemId": "story-abc123",
      "title": "Implement PDF upload endpoint",
      "description": "...",
      "priority": "High",
      "category": "Core Workflow"
    }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `confirmed` | boolean | yes | MUST be `true`; 400 if missing or false |
| `items` | array | yes | Non-empty array |
| `items[].internalItemId` | string | yes | Session-scoped internal ID |
| `items[].type` | `'story' \| 'task'` | yes | Determines hierarchy |
| `items[].parentInternalItemId` | string | conditional | Required when `type === 'task'` |
| `items[].title` | string | yes | Non-empty |
| `items[].description` | string | no | Used in issue body |
| `items[].acceptanceCriteria` | string[] | no | Used in issue body (stories only) |
| `items[].priority` | string | no | Mapped to `priority:high/medium/low` label |
| `items[].category` | string | no | Added as a label on the GitHub issue |

**Response 200**:
```json
{
  "publishTimestamp": "2026-07-07T14:32:00.000Z",
  "projectOwner": "myorg",
  "projectNumber": 5,
  "repoOwner": "myorg",
  "repoName": "product-backend",
  "results": [
    {
      "internalItemId": "story-abc123",
      "githubIssueNumber": 101,
      "githubIssueUrl": "https://github.com/myorg/product-backend/issues/101",
      "status": "created",
      "errorMessage": null,
      "retryEligible": false
    },
    {
      "internalItemId": "task-def456",
      "githubIssueNumber": 102,
      "githubIssueUrl": "https://github.com/myorg/product-backend/issues/102",
      "status": "created",
      "errorMessage": null,
      "retryEligible": false
    }
  ]
}
```

**Response 200 — partial success** (some items failed):
```json
{
  "publishTimestamp": "2026-07-07T14:32:05.000Z",
  "projectOwner": "myorg",
  "projectNumber": 5,
  "repoOwner": "myorg",
  "repoName": "product-backend",
  "results": [
    {
      "internalItemId": "story-abc123",
      "githubIssueNumber": 101,
      "githubIssueUrl": "https://github.com/myorg/product-backend/issues/101",
      "status": "created",
      "errorMessage": null,
      "retryEligible": false
    },
    {
      "internalItemId": "task-def456",
      "githubIssueNumber": null,
      "githubIssueUrl": null,
      "status": "failed",
      "errorMessage": "GitHub rate limit reached — retry after 2026-07-07T15:00:00Z",
      "retryEligible": true
    }
  ]
}
```

**Response 200 — idempotent skip** (already published in a previous call):
```json
{
  "results": [
    {
      "internalItemId": "story-abc123",
      "githubIssueNumber": 101,
      "githubIssueUrl": "https://github.com/myorg/product-backend/issues/101",
      "status": "skipped",
      "errorMessage": null,
      "retryEligible": false
    }
  ]
}
```

**Response 400 — missing confirmed**:
```json
{
  "statusCode": 400,
  "message": "Publish requires explicit confirmation. Set confirmed: true in the request body.",
  "error": "Bad Request"
}
```

**Response 400 — no approved items**:
```json
{
  "statusCode": 400,
  "message": "No items to publish. At least one approved story is required.",
  "error": "Bad Request"
}
```

**Response 503** — MCP server unavailable (same shape as configure 503 above).

**Notes**:
- The endpoint returns `200` even for partial failures; the `results` array carries per-item
  outcomes. Clients MUST inspect each result's `status` field.
- Items are always processed story-first, then child tasks in story order.
- The sub-issues API is attempted for task items; on 404/422, the title-prefix fallback is used
  and the result includes `fallbackUsed: true` (informational, not in the main schema above).
- The NestJS service checks the session's `githubPublishSession` before calling the MCP server;
  items already in `results` with `status: 'created'` are returned as `skipped`.

---

## SSE Events (extended from MVP1 `/api/analyse`)

The existing `POST /api/analyse` SSE stream gains two new event types for this feature:

### Event: `github_context_fetch` (progress)

Emitted when the GitHub MCP server is called to fetch project items.

```json
{
  "type": "progress",
  "step": "github_context_fetch",
  "message": "Fetching GitHub Projects context…",
  "itemCount": null
}
```

Followed by a completion event:
```json
{
  "type": "progress",
  "step": "github_context_ready",
  "message": "GitHub Projects context loaded (142 items)",
  "itemCount": 142
}
```

Or if truncated:
```json
{
  "type": "progress",
  "step": "github_context_truncated",
  "message": "Context limited to 200 most-recent items (project has 547 total)",
  "itemCount": 200
}
```

### Event: `connection_error`

Emitted when the GitHub MCP server fails during analysis.

```json
{
  "type": "connection_error",
  "source": "github_mcp",
  "message": "GitHub connection failed — falling back to manual upload",
  "fallbackEnabled": true
}
```

Angular's `analysis.service.ts` listens for this event and re-enables the JSON upload field.
