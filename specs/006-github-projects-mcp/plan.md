# Implementation Plan: GitHub Projects Backlog Integration via Local GitHub MCP Server

**Branch**: `006-github-projects-mcp` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Status**: Approved — ready for `/speckit-tasks`

**Supersedes**: `specs/003-mcp-custom-skills/plan.md` — replaces multi-system MCP adapter architecture with a single GitHub Projects v2 path via `@github/github-mcp-server` stdio subprocess.

---

## Summary

Extend the Smart Backlog Assistant (Angular 17 + NestJS 10 Nx monorepo) with a GitHub Projects v2
backlog integration accessed through the official `@github/github-mcp-server` npm package, run as
a local stdio subprocess by the NestJS backend. The NestJS backend acts as an MCP client using
`@modelcontextprotocol/sdk`'s `StdioClientTransport`. A reviewer configures their GitHub
organization, project board, and target repository via a Settings UI panel. Once configured:
(1) analysis fetches up to 200 live project items as read-only AI context, replacing the manual
JSON file upload; (2) approved stories and tasks are published directly to GitHub as Issues on
the configured board; (3) the Claude Code `/speckit-import-backlog` skill is updated to use the
same server via `.claude/mcp.json`. No Jira, Linear, or Azure DevOps integration is included in
this release (spec 003 superseded).

---

## Technical Context

**Language/Version**: TypeScript 5.x (existing Nx workspace)

**Primary Dependencies**:
- `@github/github-mcp-server` (npm) — official GitHub MCP server, launched via `npx -y @github/github-mcp-server stdio`
- `@modelcontextprotocol/sdk` — MCP client SDK; `Client` class + `StdioClientTransport`
- NestJS 10 (existing) — backend; MCP client lives in `GithubMcpModule`
- Angular 17 (existing) — frontend; connection config UI + status badge
- RxJS (existing) — session state observables extended with `githubConnection$`, `isGithubConnected$`

**Storage**: In-memory session state only (no new persistence layer). `GitHubProjectsConnection`
and `GitHubPublishSession` are stored in Angular `SessionService` (`BehaviorSubject`) for the
session lifetime. No database or file writes for app state (only `backlog-context.json` for the
CLI skill path).

**Testing**: Jest (unit), Cypress (E2E) — existing framework. No new test framework added.
Tests are optional per the constitution; the quickstart.md provides the manual validation path.

**Target Platform**: Windows x64 (same as MVP1 `backlog-assistant.exe`). The `@github/github-mcp-server`
subprocess is spawned by the packaged NestJS process; `node_modules/` must be available at
runtime alongside the `.exe`. (Same as the existing `pdf-parse` runtime dependency pattern.)

**Project Type**: Web application (Angular SPA + NestJS API, packaged as Windows exe)

**Performance Goals**:
- Live context fetch: ≤ 10 seconds for 200 items (GitHub API rate-limited)
- Full analysis with live context: ≤ 60 seconds (same as MVP1 SC-010)
- Publish (per item): ≤ 3 seconds per GitHub issue creation
- Status endpoint: ≤ 2 seconds response time

**Constraints**:
- `GITHUB_TOKEN` MUST NOT appear in any AI model API payload, SSE event, audit log, or log file
- Maximum 200 items fetched per analysis session (FR-006)
- Sub-issues API fallback required (not all repos have the feature enabled)
- `@github/github-mcp-server` and MCP SDK packages are dev dependencies only — NOT bundled in `backlog-assistant.exe`

**Scale/Scope**: Single reviewer per session (MVP1 constraint unchanged). Up to 200 GitHub
Project items per analysis. GitHub API secondary rate limits apply at scale; out of scope for MVP.

---

## Constitution Check

*GATE: Evaluated against constitution.md v1.1.0*

### I. Human Oversight ✅ PASS

- **Requirement**: No autonomous issue creation without explicit reviewer action.
- **Implementation**: `POST /api/github-projects/publish` enforces `confirmed: true` in the
  request body. The `GithubPublishConfirmationComponent` shows a pre-publish summary modal and
  Confirm button — no API call is made without this click (T032).
- **Violation risk**: None. The `confirmed` guard is enforced at the NestJS controller level,
  not just in the Angular UI.

### II. Transparency & Explainability ✅ PASS

- **Requirement**: Each AI suggestion must include a rationale; progress must be visible.
- **Implementation**: The analysis progress SSE stream gains a new `github_context_fetch` event
  shown in the UI as "Fetching GitHub Projects context…" (FR-007). Truncation at 200 items is
  also surfaced as a distinct progress notice (FR-006).

### III. Privacy & Intellectual Property ✅ PASS

- **Requirement**: PII and credentials must never reach the AI model; data is session-scoped.
- **Implementation**: `GithubMcpCredentialsService` is the sole holder of the `GITHUB_TOKEN`
  value; it passes the token only to `StdioClientTransport.env` at subprocess spawn. No other
  service receives the raw token. Verified by the module wiring in `GithubMcpModule`. The
  credential isolation assertion (T025 from spec 003, extended here as T041 validation) confirms
  no token leakage into `AiService` calls.

### IV. AI Safety & Behavior ✅ PASS

- **Requirement**: No new AI model changes; existing prompt pinning unchanged.
- **Implementation**: No new AI calls introduced. The GitHub context items are passed to the
  existing overlap detection service (not to the AI model directly). The AI model receives only
  anonymized references (item titles for overlap detection, same as the existing JSON upload path).

### V. Scope Integrity ✅ PASS

- **Requirement**: No scope beyond what the spec implies.
- **Implementation**: Feature strictly scoped to GitHub Projects v2. Azure DevOps, Linear, and
  Jira are explicitly deferred to a future release and documented in the spec Assumptions section.
  Multi-repository publish is out of scope. Fine-grained PATs are deferred. All tasks in
  `tasks.md` map to a spec requirement (FR-001–FR-019) or user story.

**Constitution Check result**: PASS — no violations. No Complexity Tracking entries required.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-github-projects-mcp/
├── spec.md              ← feature specification
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions (all unknowns resolved)
├── data-model.md        ← entity definitions
├── quickstart.md        ← end-to-end validation guide
├── contracts/
│   └── github-projects-api.md  ← NestJS REST API contracts + SSE events
└── tasks.md             ← implementation tasks (generated by /speckit-tasks)
```

### Source Code (repository root — Nx monorepo)

```text
smart-backlog-assistant/
├── .env.example                              ← updated: add GITHUB_TOKEN placeholder
├── .gitignore                                ← verified: .env excluded
├── pkg.config.json                           ← verified: .env excluded from exe
├── .claude/
│   └── mcp.json                              ← GitHub MCP server entry for Claude Code skills
│   └── skills/
│       └── speckit-import-backlog/
│           └── SKILL.md                      ← updated: GitHub MCP path replaces Jira/Linear
├── libs/
│   └── shared/
│       └── src/
│           └── entities/
│               ├── github-projects-connection.entity.ts   ← new
│               ├── github-project-item.entity.ts          ← new
│               └── github-publish.entity.ts               ← new (GitHubPublishResult + GitHubPublishSession)
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── app.module.ts                              ← updated: register GithubMcpModule
│   │       └── github-mcp/                               ← new module
│   │           ├── github-mcp.module.ts
│   │           ├── github-mcp-client.service.ts           ← spawns subprocess, MCP client
│   │           └── github-mcp-credentials.service.ts      ← reads .env token
│   │       └── github-projects/                          ← new module
│   │           ├── github-projects.module.ts
│   │           ├── github-projects.controller.ts          ← REST endpoints
│   │           ├── github-projects.service.ts             ← status + configure
│   │           ├── github-projects-context.service.ts     ← fetches items for analysis
│   │           └── github-projects-publish.service.ts     ← creates issues, adds to board
│   │       └── analyse/
│   │           ├── analyse.service.ts                     ← updated: calls context service
│   │           └── analyse.dto.ts                         ← updated: backlogSourceType field
│   │       └── overlap/
│   │           └── overlap.service.ts                     ← updated: accepts GitHubProjectItem[]
│   └── web/
│       └── src/
│           └── app/
│               ├── core/
│               │   ├── session.service.ts                 ← updated: githubConnection$ + publishResults$
│               │   └── analysis.service.ts                ← updated: passes backlogSourceType
│               ├── features/
│               │   ├── settings/
│               │   │   └── github-projects-config.component.ts  ← new: owner/project form
│               │   ├── input/
│               │   │   └── input.component.ts             ← updated: hide JSON upload when connected
│               │   └── publish/
│               │       ├── publish.component.ts           ← updated: add GitHub Publish button
│               │       ├── github-publish-confirmation.component.ts  ← new: confirmation modal
│               │       └── github-publish-results.component.ts      ← new: per-item results
│               └── shared/
│                   └── components/
│                       └── github-connection-badge.component.ts  ← new: header badge
```

**Structure Decision**: Extends the existing Nx monorepo (Option 2 web application structure
from the template). New NestJS modules follow the pattern established in MVP1 (`analyse/`,
`export/`, `session/`). New Angular components follow the lazy-loaded feature module pattern
from `002-ui-results-display`. The `GithubMcpModule` is global (singleton subprocess) while
`GithubProjectsModule` is feature-scoped.

---

## Key Library Usage

### `@modelcontextprotocol/sdk` — MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@github/github-mcp-server', 'stdio'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: token },
});

const client = new Client({ name: 'backlog-assistant', version: '1.0.0' }, {
  capabilities: {}
});
await client.connect(transport);

// Call a tool
const result = await client.callTool({
  name: 'list_project_items',
  arguments: { owner: 'myorg', project_number: 5, per_page: 100 }
});
```

### Key MCP Tool Calls (GitHub MCP Server)

| Operation | MCP Tool | Key Args |
|---|---|---|
| List accessible project boards | `list_projects` | `owner`, `per_page` |
| Get project metadata + item count | `get_project` | `owner`, `project_number` |
| Fetch project items | `list_project_items` | `owner`, `project_number`, `per_page`, `after` |
| Create a story/task issue | `create_issue` | `owner`, `repo`, `title`, `body`, `labels` |
| Link task as sub-issue | `create_sub_issue` | `owner`, `repo`, `issue_number`, `sub_issue_id` |
| Add issue to project board | `add_issue_to_project` | `project_id`, `issue_node_id` |

### Pagination Strategy for `list_project_items`

```typescript
async fetchItems(owner: string, projectNumber: number): Promise<GitHubProjectItem[]> {
  const items: GitHubProjectItem[] = [];
  let cursor: string | null = null;
  
  do {
    const result = await this.client.callTool({
      name: 'list_project_items',
      arguments: { owner, project_number: projectNumber, per_page: 100, after: cursor }
    });
    const page = this.mapToItems(result);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 200);
  
  // Sort by updatedAt descending, cap at 200
  return items
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 200);
}
```

---

## Issue Label Mapping

Approved stories and tasks are published with structured labels for traceability:

| Source field | GitHub label |
|---|---|
| Priority: High | `priority:high` |
| Priority: Medium | `priority:medium` |
| Priority: Low | `priority:low` |
| Category: Core Workflow | `category:core-workflow` |
| Category: Data Management | `category:data-management` |
| Category: Compliance | `category:compliance` |
| Category: Reporting | `category:reporting` |
| Generated by | `backlog-assistant` (always added) |

Labels are created in the target repository if they don't already exist (via the `create_label`
MCP tool, called lazily before the first issue creation).

---

## Issue Body Template (Stories)

```markdown
## User Story

**As a** [role], **I want to** [benefit].

## Acceptance Criteria

- [ ] [AC1]
- [ ] [AC2]
- [ ] [AC3]

## Metadata

- **Priority**: [High / Medium / Low]
- **Category**: [category label]
- **Confidence**: [High / Medium / Low]
- **Rationale**: [AI-generated rationale]

---
*Generated by Smart Backlog Assistant — reviewed and approved by [reviewer]*
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@github/github-mcp-server` tool names differ from documented | Medium | High | Research.md Decision 1 lists specific tool names; verify against `npx @github/github-mcp-server list-tools` during T009 setup |
| Sub-issues API unavailable in target repo | High | Low | Fallback implemented in T029 (title-prefix); reviewer notified |
| `npx -y` cold start > 5s on first run | Medium | Medium | Warm up on `OnModuleInit`; first request pays the cost; subsequent calls reuse existing subprocess |
| GitHub PAT scope validation not surfaced correctly | Low | High | Token scope check in T041 validates on startup before first user interaction |
| `pkg` bundle doesn't find `node_modules/@github/github-mcp-server` at runtime | Medium | High | Use `npx` (fetches from npm cache) not `node_modules/.bin`; document runtime requirement in quickstart.md |

---

## Complexity Tracking

No constitution violations. This section is not required.
