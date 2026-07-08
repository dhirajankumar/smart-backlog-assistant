# Data Model: GitHub Projects Backlog Integration

**Feature**: 006-github-projects-mcp
**Date**: 2026-07-07
**Source**: spec.md Key Entities + research.md Decisions 3, 7, 8

---

## New Entities (this feature)

### GitHubProjectsConnection

Represents the active link to a GitHub Projects v2 board. Stored in-memory in the NestJS backend
(session-scoped, not persisted). Communicated to the Angular frontend via `SessionService`.

**Location**: `libs/shared/src/entities/github-projects-connection.entity.ts`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `owner` | `string` | required; max 100 chars | GitHub org or user login |
| `projectNumber` | `number` | required; positive integer | GitHub Projects v2 project number |
| `projectName` | `string` | optional; populated after successful test | Human-readable project name from GitHub |
| `repoOwner` | `string` | required | Owner of the target repository for issue creation |
| `repoName` | `string` | required | Name of the target repository for issue creation |
| `status` | `'active' \| 'error' \| 'unconfigured'` | required | `unconfigured` until configured; `active` after successful validate; `error` on failure |
| `errorMessage` | `string \| null` | optional | Populated when `status === 'error'` |
| `itemCount` | `number \| null` | optional | Populated after successful `GET /api/github-projects/status` |

**State transitions**:
```
unconfigured → [POST /api/github-projects/configure + MCP validation succeeds] → active
active       → [MCP server crash or API error]                                  → error
error        → [POST /api/github-projects/configure again]                      → active | error
```

---

### GitHubProjectItem

A read-only item fetched from GitHub Projects v2 for use as AI context during analysis.
Used solely for overlap detection — never persisted or modified.

**Location**: `libs/shared/src/entities/github-project-item.entity.ts`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `issueNumber` | `number` | required | GitHub issue number |
| `title` | `string` | required | Issue title — primary field for overlap detection |
| `body` | `string \| null` | optional | Issue body / description |
| `status` | `string` | required | Issue state (e.g., `OPEN`, `CLOSED`, `IN_PROGRESS`) |
| `priority` | `string \| null` | optional | Mapped from custom "Priority" project field; null if not set |
| `labels` | `string[]` | required | Array of label names on the issue |
| `updatedAt` | `Date` | required | ISO 8601 timestamp; used for 200-item sorting (most-recent first) |
| `repositoryName` | `string` | required | Name of the repository the issue belongs to |

**Fetch constraints**:
- Maximum 200 items per analysis session (most-recently-updated first)
- Items are sorted client-side by `updatedAt` descending after fetching
- When total items > 200, `truncated: true` is set in `LiveBacklogContext` (existing MVP1 entity, extended)

---

### GitHubPublishResult

The outcome of a single item's publish action to GitHub.

**Location**: `libs/shared/src/entities/github-publish.entity.ts`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `internalItemId` | `string` | required | Internal session ID of the user story or task |
| `githubIssueNumber` | `number \| null` | nullable | Populated on success |
| `githubIssueUrl` | `string \| null` | nullable | Full URL to the created issue on GitHub |
| `status` | `'created' \| 'failed' \| 'skipped'` | required | `skipped` when idempotency detects existing issue |
| `errorMessage` | `string \| null` | nullable | Populated when `status === 'failed'` |
| `retryEligible` | `boolean` | required | `true` when `status === 'failed'`; `false` for `created` or `skipped` |

---

### GitHubPublishSession

The aggregate result of a publish action for an entire review session.

**Location**: `libs/shared/src/entities/github-publish.entity.ts` (same file as `GitHubPublishResult`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `publishTimestamp` | `Date` | required | When the publish was initiated |
| `projectOwner` | `string` | required | GitHub org/user for the target project |
| `projectNumber` | `number` | required | GitHub Projects v2 project number |
| `repoOwner` | `string` | required | Repository owner for issue creation |
| `repoName` | `string` | required | Repository name for issue creation |
| `results` | `GitHubPublishResult[]` | required; non-empty | One entry per approved story and approved task |

---

## Existing Entities Extended by This Feature

### SessionState (extended in Angular `session.service.ts`)

Two new fields added to the existing `SessionState` interface:

| New Field | Type | Notes |
|---|---|---|
| `githubConnection` | `GitHubProjectsConnection \| null` | Active GitHub Projects connection; null when unconfigured |
| `githubPublishSession` | `GitHubPublishSession \| null` | Populated after first publish action |

**Location**: `apps/web/src/app/core/session.service.ts`

New derived observables:
- `githubConnection$: Observable<GitHubProjectsConnection | null>` — emits on configuration change
- `isGithubConnected$: Observable<boolean>` — derived from `githubConnection$ | status === 'active'`
- `githubPublishResults$: Observable<GitHubPublishResult[]>` — derived from `githubPublishSession$`
- `publishedItemMap$: Observable<Map<string, number>>` — maps `internalItemId` → `githubIssueNumber`

### LiveBacklogContext (extended — existing MVP1 entity)

No new fields. This entity already has `truncated: boolean` and `items[]`. For the GitHub MCP
path, `items[]` is populated with `GitHubProjectItem` instances (the `title` field is used for
overlap detection, consistent with how `ExistingBacklogItem.title` is used in MVP1).

---

## Entity Relationships

```
GitHubProjectsConnection (1)
  └─── configures analysis context fetch (many) ───► GitHubProjectItem[]
  └─── configures publish target (many) ───────────► GitHubPublishSession

GitHubPublishSession (1)
  └─── contains (many) ─────────────────────────────► GitHubPublishResult[]

GitHubPublishResult (many)
  └─── references (1) ──────────────────────────────► UserStory | Task (from MVP1 session)
```

---

## Validation Rules

| Entity | Field | Rule |
|---|---|---|
| `GitHubProjectsConnection` | `owner` | Non-empty string, max 100 chars |
| `GitHubProjectsConnection` | `projectNumber` | Positive integer |
| `GitHubProjectsConnection` | `repoOwner` + `repoName` | Non-empty; validated via MCP tool call |
| `GitHubProjectItem` | `issueNumber` | Positive integer |
| `GitHubProjectItem` | `updatedAt` | Valid ISO 8601 date |
| `GitHubPublishResult` | `status` | Enum value only |
| `GitHubPublishResult` | `githubIssueNumber` | Positive integer when `status === 'created'` |
| `POST /api/github-projects/publish` | `confirmed` | MUST be `true`; request rejected without it |

---

## Credential Exclusion Rule

`GITHUB_TOKEN` is NOT an entity field in any of the above. It lives exclusively in:
1. `.env` (local file, excluded from git and `pkg` bundle)
2. `GithubMcpClientService.transport.env` (at subprocess spawn time only)

No entity, DTO, SSE payload, or audit log entry may contain the raw token value.
