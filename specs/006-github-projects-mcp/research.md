# Research: GitHub Projects Backlog Integration via Local GitHub MCP Server

**Feature**: 006-github-projects-mcp
**Date**: 2026-07-07
**Status**: Complete — all unknowns resolved

---

## Decision 1: GitHub MCP Server Package

**Decision**: Use `@github/github-mcp-server` (GitHub's official MCP server, available via npm)
launched as a local subprocess by the NestJS backend.

**Rationale**: The official GitHub MCP server (`github-mcp-server`, published under the
`@github` npm scope) is the authoritative implementation. It is maintained by GitHub, covers
GitHub REST + GraphQL APIs including Projects v2, and supports stdio transport natively —
matching our requirement for a local, no-cloud-relay MCP server. The community
`@modelcontextprotocol/server-github` package is older and does not cover Projects v2 boards.

**Launch command**:
```
GITHUB_PERSONAL_ACCESS_TOKEN=<token> npx -y @github/github-mcp-server stdio
```

**Available tools relevant to this feature** (from the github-mcp-server tool registry):
- `list_projects` — list GitHub Projects v2 for an owner (org or user)
- `get_project` — get project metadata (id, title, item count)
- `list_project_items` — list items in a project (issues, drafts, PRs) with field values
- `create_issue` — create a GitHub issue in a repository
- `add_issue_to_project` — add an existing issue to a GitHub Projects v2 board
- `update_issue` — update issue fields (used for labels)
- `create_sub_issue` — create a sub-issue linked to a parent issue (Projects v2 only)

**Alternatives considered**:
- `@modelcontextprotocol/server-github` (community) — does not support Projects v2; rejected.
- GitHub REST API directly from NestJS — would bypass MCP architecture, inconsistent with
  the speckit skill path that uses MCP tools; rejected.
- GitHub GraphQL API directly — feasible but adds direct auth handling in NestJS; rejected
  in favour of the MCP abstraction layer (same as CLI skill path).

---

## Decision 2: NestJS MCP Client Architecture (stdio transport)

**Decision**: Spawn `@github/github-mcp-server` as a child process from NestJS using
`child_process.spawn` and connect to it via `@modelcontextprotocol/sdk`'s `StdioClientTransport`
and `Client` class.

**Implementation pattern**:
```typescript
// In GithubMcpClientService (NestJS Injectable)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@github/github-mcp-server', 'stdio'],
  env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
});
const client = new Client({ name: 'backlog-assistant', version: '1.0.0' });
await client.connect(transport);
```

**Tool call pattern**:
```typescript
const result = await client.callTool({
  name: 'list_project_items',
  arguments: { owner: 'myorg', project_number: 5, per_page: 200 }
});
```

**Lifecycle**:
- `OnModuleInit`: `await client.connect(transport)` — spawns subprocess and handshakes
- `OnApplicationShutdown`: `await client.close()` — closes transport, subprocess exits
- If the subprocess exits unexpectedly: `transport.onclose` fires; service marks status `error`

**Rationale**: `StdioClientTransport` in `@modelcontextprotocol/sdk` manages the subprocess
lifecycle and JSON-RPC framing over stdin/stdout. This avoids manually managing the process I/O
protocol. Using `npx -y` ensures the package is installed/updated without a permanent global
install.

**Alternatives considered**:
- HTTP/SSE transport — requires the MCP server to already be running; not self-contained. Rejected.
- Child process with manual JSON-RPC — error-prone, maintenance burden. Rejected.

---

## Decision 3: GitHub Projects v2 Data Shape

**Decision**: Use the `list_project_items` MCP tool; map its output to `GitHubProjectItem`.

**Projects v2 item fields available via MCP tools**:

| MCP field | Our entity field |
|---|---|
| `number` (issue number) | `issueNumber` |
| `title` | `title` |
| `body` | `body` |
| `state` | `status` |
| `labels[].name` | `labels` (string[]) |
| `updatedAt` | `updatedAt` |
| `repository.name` | `repositoryName` |
| Custom project field "Priority" | `priority` (mapped from field value) |

**Pagination**: `list_project_items` supports `per_page` (up to 100) and `after` (cursor).
The 200-item cap requires at most 2 paginated calls. Items are sorted by `updatedAt` descending
on the client side (the MCP tool returns them in creation order; client re-sorts).

**Alternatives considered**:
- Direct GraphQL `projectsV2` query — equivalent data but bypasses MCP abstraction. Rejected.

---

## Decision 4: GitHub Sub-Issues API

**Decision**: Attempt `create_sub_issue` MCP tool for task linking; fall back to title-prefix
(`[US#N] Task title`) if the API returns an error.

**Sub-issues availability**: GitHub sub-issues are a Projects v2-only feature, currently in
public beta. The `create_sub_issue` REST endpoint (`POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues`)
returns HTTP 404 for repositories not enrolled in the beta and HTTP 422 for invalid parent
references. The NestJS publish service catches these errors and applies the title-prefix fallback.

**Fallback pattern**:
```typescript
try {
  await client.callTool({ name: 'create_sub_issue', arguments: { ... } });
} catch (err) {
  if (err.status === 404 || err.status === 422) {
    // Fall back: create regular issue with "[US#N] " prefix
    title = `[US#${parentIssueNumber}] ${task.title}`;
    await client.callTool({ name: 'create_issue', arguments: { title, ... } });
  }
}
```

**Rationale**: The fallback ensures task issues are created even for repos not in the beta.
The reviewer is notified when the fallback is used via a session-level notice.

---

## Decision 5: GitHub PAT Scopes and Validation

**Decision**: Require GitHub Personal Access Token (classic) with `project` (read/write) and
`repo` (or `public_repo` for public repositories) scopes. Validate on startup via the
`get_authenticated_user` MCP tool; check returned `scopes` header.

**Required scopes**:
- `project` — read/write access to GitHub Projects v2
- `repo` — read/write access to repository issues (for private repos)
- `public_repo` — sufficient for public repositories

**Fine-grained PAT limitation**: Fine-grained PATs use repository-level permissions and do not
support project-level permissions for Projects v2 at the time of this spec. Classic PATs are
required.

**Scope validation approach**:
```typescript
// On startup: call a low-cost MCP tool and inspect response headers
const authResult = await client.callTool({ name: 'get_me', arguments: {} });
// The github-mcp-server returns scope info in the tool response metadata
```

If scope validation fails, `GithubMcpCredentialsService` sets status to `error` and the
`GET /api/github-projects/status` endpoint returns a structured error with the required scopes.

---

## Decision 6: `.claude/mcp.json` Configuration for Claude Code Skills

**Decision**: Use the same `@github/github-mcp-server` package in `.claude/mcp.json` for the
Claude Code skill path (`/speckit-import-backlog`), reading `GITHUB_PERSONAL_ACCESS_TOKEN` from
the local shell environment.

**`.claude/mcp.json` entry**:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@github/github-mcp-server", "stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Key distinction**: This MCP server instance is launched and managed by Claude Code (the CLI)
for skill execution. It is a separate process from the NestJS backend's MCP client subprocess.
Both use the same npm package but with independent process lifecycles and auth tokens.

---

## Decision 7: Credential Isolation Strategy

**Decision**: `GithubMcpCredentialsService` reads `GITHUB_TOKEN` from `.env` via NestJS
`ConfigService` on startup. The raw token is passed only to `StdioClientTransport.env` at
process spawn time. No other service receives the token value. All other services receive only
`tokenPresent: boolean` from the credentials service.

**Token audit surface**:
- `GITHUB_TOKEN` → `ConfigService` → `GithubMcpCredentialsService` → `StdioClientTransport.env`
- No other path. Verified by code review of `GithubMcpModule` wiring.

**`.env` exclusions**:
- `.gitignore`: `.env`, `.env.local`, `*.env`
- `pkg.config.json`: `assets: { exclude: [".env"] }`

**Rationale**: Constitution Principle III (Privacy) requires that PII and credentials never
reach the AI model. The isolation boundary is `GithubMcpClientService` — callers receive tool
results, not token access.

---

## Decision 8: NestJS Module Wiring and AppModule Registration

**Decision**: `GithubMcpModule` is a global NestJS module registered in `AppModule`. It
provides `GithubMcpClientService` and `GithubMcpCredentialsService` as globally injectable
singletons. `GithubProjectsModule` imports `GithubMcpModule` and injects the client service.

**Module dependency graph**:
```
AppModule
  └── GithubMcpModule (global)
        ├── GithubMcpClientService  → spawns subprocess, calls MCP tools
        └── GithubMcpCredentialsService → reads .env token
  └── GithubProjectsModule
        ├── GithubProjectsService       (depends on GithubMcpClientService)
        ├── GithubProjectsContextService (depends on GithubMcpClientService)
        ├── GithubProjectsPublishService (depends on GithubMcpClientService)
        └── GithubProjectsController    (exposes REST endpoints)
```

**Alternatives considered**:
- Lazy initialization (spawn MCP server only when first request arrives) — risks first-request
  latency and complicates health check. Rejected in favour of eager startup.
- Per-request MCP client — `npx` startup cost (~2s) makes this unacceptable per request.
  Rejected.

---

## Summary: All NEEDS CLARIFICATION Items Resolved

| Unknown | Resolution |
|---|---|
| Correct npm package for GitHub MCP server | `@github/github-mcp-server` (official) |
| MCP client SDK class and transport | `@modelcontextprotocol/sdk` `Client` + `StdioClientTransport` |
| GitHub Projects v2 data shape | Mapped in Decision 3 |
| Sub-issues API fallback | Title-prefix `[US#N]` on 404/422 |
| PAT scopes | `project` + `repo` (classic PAT only) |
| `.claude/mcp.json` config format | Shown in Decision 6 |
| Credential isolation | GithubMcpCredentialsService boundary (Decision 7) |
| NestJS module wiring | GithubMcpModule global singleton (Decision 8) |
