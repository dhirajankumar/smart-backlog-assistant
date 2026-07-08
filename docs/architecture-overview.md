# Architecture Overview — Smart Backlog Assistant

**Stack**: Angular 17 + NestJS 10 (Nx monorepo) | **Updated**: 2026-07-08

---

## 1. High-Level Structure

```
┌─────────────────────┐     ┌──────────────────────────────────────┐
│   apps/web          │     │   apps/api  (NestJS)                 │
│   (Angular 17)      │     │                                      │
│                     │     │  AnalyseModule   →  Anthropic API    │
│  /input             │◄───►│  AiModule        →  claude-sonnet    │
│  /analysis          │     │  RegenerateModule                    │
│  /review            │     │  GithubMcpModule  →  github-mcp-server│
│  /backlog           │     │  GithubProjectsModule                │
│  /publish           │     │  PdfModule / OverlapModule           │
│  /settings          │     │                                      │
└─────────────────────┘     └──────────────────────────────────────┘
         │                                   │
         └──── localhost:3000 ───────────────┘
                                             │
                             ┌───────────────┴──────────────┐
                             │  External Services            │
                             │  • Anthropic Claude API       │
                             │  • github-mcp-server (stdio)  │
                             │  • GitHub Projects v2 (GraphQL│
                             └──────────────────────────────┘

  Distributed as: dist/backlog-assistant.exe  (~60 MB, Windows x64)
```

---

## 2. Core Analysis Flow (MVP1)

User pastes requirements → AI generates stories → Reviewer approves/rejects/amends → Export JSON

```
Browser                    NestJS                     Claude API
  │                           │                           │
  │  POST /api/analyse        │                           │
  │  (text + optional PDF) ──►│  extract + validate       │
  │                           │──── summarise prompt ────►│
  │◄── SSE: progress ─────── │◄─── summary JSON ─────── │
  │                           │──── story generation ────►│
  │◄── SSE: story ×N ──────  │◄─── streaming JSON ─────  │
  │◄── SSE: complete ──────── │                           │
  │                           │                           │
  │  approve / reject / amend │  (in-browser state only)  │
  │  POST /api/regenerate ───►│──── regen prompt ────────►│
  │◄── SSE: revised story ─── │◄─── streaming JSON ─────  │
  │                           │                           │
  │  POST /api/analyse/tasks  │──── task gen prompt ─────►│
  │◄── JSON: Task[] ──────── │◄─── JSON ───────────────  │
```

> Session state lives in the browser. Nothing is persisted server-side.

---

## 3. GitHub Projects Flow (MVP2)

```
Browser                    NestJS                  github-mcp-server     GitHub
  │                           │                          │                  │
  │  /settings/github-projects│                          │                  │
  │  enter PAT + owner ──────►│                          │                  │
  │                           │── list_projects ────────►│── GraphQL ──────►│
  │◄── board list ─────────── │◄─ project list ──────── │◄─ Projects v2 ── │
  │                           │                          │                  │
  │  select board ───────────►│  store connection        │                  │
  │                           │                          │                  │
  │  /backlog (live view) ───►│── list_project_items ───►│── GraphQL ──────►│
  │◄── live board items ───── │◄─ items[] ────────────── │◄─ board items ── │
  │                           │                          │                  │
  │  Publish to GitHub ──────►│  create issues + add     │                  │
  │                           │  to project ────────────►│── create_issue ─►│
  │◄── publish results ─────  │◄─ results[] ─────────── │                  │
```

> Publish is idempotent — already-created issues are skipped (tracked by `internalItemId`).

---

## 4. Where AI Is Called

| Trigger | Endpoint | Output |
|---|---|---|
| Analyse requirements | `POST /api/analyse` | `KeyRequirementsSummary` + `UserStory[]` via SSE |
| Generate tasks | `POST /api/analyse/tasks` | `Task[]` JSON |
| Regenerate story | `POST /api/regenerate` | Revised `UserStory` via SSE |

GitHub publish makes **no AI calls** — it calls `github-mcp-server` tools directly via MCP stdio.

---

## 5. GitHub MCP Module

```
GithubMcpModule  (global singleton)
├── GithubMcpCredentialsService   reads GITHUB_TOKEN from .env
└── GithubMcpClientService        MCP Client → StdioClientTransport
    │  spawns subprocess:
    │    dev:  npx -y github-mcp-server stdio
    │    pkg:  node <execDir>/github-mcp-server/mcp-cli.js stdio
    └── callTool(name, args)

GithubProjectsModule
├── GithubProjectsService          connection state + board listing
├── GithubProjectsContextService   fetches live items for prompt injection
├── GithubProjectsPublishService   issue creation + project card addition
└── GithubProjectsController       REST at /api/github-projects/*
```

**API endpoints** (`/api/github-projects/`):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/status` | Connection state + configured board |
| `GET` | `/boards?owner=` | List GitHub Projects v2 boards |
| `POST` | `/configure` | Store owner, projectNumber, repo |
| `GET` | `/items` | Fetch live board items |
| `POST` | `/publish` | Create issues + add to board |

---

## References

- Approved plan: [`specs/001-ai-backlog-refinement/plan.md`](../specs/001-ai-backlog-refinement/plan.md)
- GitHub Projects MCP spec: [`specs/006-github-projects-mcp/`](../specs/006-github-projects-mcp/)
- ADR-001 (stack): [`docs/decisions/ADR-001-angular-nestjs-nx.md`](decisions/ADR-001-angular-nestjs-nx.md)
- ADR-003 (AI safety): [`docs/decisions/ADR-003-model-pinning.md`](decisions/ADR-003-model-pinning.md)
- ADR-006 (GitHub MCP): [`docs/decisions/ADR-006-github-projects-mcp.md`](decisions/ADR-006-github-projects-mcp.md)
