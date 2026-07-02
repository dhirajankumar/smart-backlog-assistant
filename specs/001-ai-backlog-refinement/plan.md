# Implementation Plan: AI-Backed Backlog Refinement — MVP1

**Branch**: `001-ai-backlog-refinement` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Status**: Approved — ready for `/speckit-tasks`

---

## Summary

Build an end-to-end AI-backed backlog refinement tool as a standalone Windows demo application.
A reviewer submits a text or PDF input (plus optional existing backlog JSON), receives a Key
Requirements Summary and AI-generated draft user stories with tasks, reviews each item through
an approve / reject / amend / feedback workflow, and publishes a structured JSON export with a
full session audit log. State is browser-session-only; the app is packaged as a portable
Windows executable via `pkg`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Monorepo | **Nx workspace** |
| Frontend | **Angular 17** (standalone components) |
| Backend | **NestJS 10** |
| Shared types | **`libs/shared`** (Nx library) |
| AI SDK | **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) |
| Session state | **Angular `SessionService`** — RxJS `BehaviorSubject`, in-memory only |
| PDF parsing | **`pdf-parse`** (primary) + **`unpdf`** (fallback) |
| UI components | **Angular Material 17** |
| Testing | **Jest** (unit + integration) + **Cypress** (E2E) |
| Demo packaging | **`pkg`** → `backlog-assistant.exe` (~60 MB, Windows x64) |

**Architecture**: Angular lazy-loaded feature modules — one per workflow step. Module Federation
(micro-frontend) is the documented post-MVP upgrade path; it is not in scope for MVP1.

---

## Source Tree

```
smart-backlog-assistant/
├── nx.json
├── package.json
├── tsconfig.base.json
├── apps/
│   ├── api/                        ← NestJS backend
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── analyse/
│   │       │   ├── analyse.module.ts
│   │       │   ├── analyse.controller.ts
│   │       │   ├── analyse.service.ts
│   │       │   └── analyse.dto.ts
│   │       ├── regenerate/
│   │       │   ├── regenerate.controller.ts
│   │       │   └── regenerate.service.ts
│   │       ├── export/
│   │       │   ├── export.controller.ts
│   │       │   └── export.service.ts
│   │       ├── ai/
│   │       │   ├── ai.module.ts
│   │       │   ├── ai.service.ts
│   │       │   └── prompts/
│   │       │       ├── prompt.registry.ts
│   │       │       ├── requirements-summary.prompt.ts
│   │       │       ├── story-generation.prompt.ts
│   │       │       ├── task-generation.prompt.ts
│   │       │       └── story-regeneration.prompt.ts
│   │       ├── pdf/
│   │       │   ├── pdf.service.ts
│   │       │   └── pdf.validator.ts
│   │       └── overlap/
│   │           └── overlap.service.ts
│   └── web/                        ← Angular frontend
│       └── src/
│           ├── main.ts
│           └── app/
│               ├── app.component.ts
│               ├── app.routes.ts
│               ├── app.config.ts
│               ├── core/
│               │   ├── session.service.ts
│               │   ├── audit.service.ts
│               │   └── analysis.service.ts
│               ├── features/
│               │   ├── input/
│               │   ├── analysis/
│               │   ├── review/
│               │   ├── tasks/
│               │   └── publish/
│               └── shared/components/
├── libs/
│   └── shared/src/
│       ├── entities/
│       ├── dtos/
│       ├── enums/
│       └── constants/
│           ├── model.ts             ← MODEL_ID = "claude-sonnet-4-6"
│           ├── categories.ts
│           └── limits.ts
├── pkg.config.json
├── build-demo.bat
└── dist/
    └── backlog-assistant.exe
```

---

## AI Integration

**Model pinning**: `MODEL_ID = "claude-sonnet-4-6"` defined in `libs/shared/src/constants/model.ts`
and imported by `apps/api/src/ai/ai.service.ts`. All prompt calls use this constant.

**Prompt versioning**: Each prompt file exports `{ build: (ctx) => string, version: "M.m.p" }`.
`prompt.registry.ts` collects all versions; every AI output and export record includes the
prompt version that produced it.

**Streaming**: NestJS `@Sse('/analyse')` returns `Observable<MessageEvent>` (RxJS). Angular
`AnalysisService` consumes it via the browser's native `EventSource`.

**SSE event types**:
```
progress      → { step: "extracting_text" | "validating_backlog" | "analysing_requirements" | "generating_stories" | "detecting_overlaps" | "complete" }
summary       → { payload: KeyRequirementsSummary }
story         → { payload: UserStory }
overlap_update → { storyId, flag }
error         → { payload: { code, message } }
```

**Timeout**: 58-second abort signal on the Anthropic SDK call. On timeout: emit partial results
+ timeout warning. Reviewer may proceed with partial results or retry.

---

## Data Flow

```
Angular InputComponent (text | PDF | backlog JSON)
  └─► POST /api/analyse   [NestJS, multipart/form-data]
        ├─ pdf-parse → plain text  (or error: PDF_IMAGE_ONLY / PDF_TOO_LARGE)
        ├─ class-validator → ExistingBacklogItem[]  (or BACKLOG_SCHEMA_INVALID)
        ├─► Anthropic SDK: requirements-summary.prompt → KeyRequirementsSummary
        ├─► Anthropic SDK: story-generation.prompt (streaming) → UserStory[]
        └─► overlap.service → patch overlap flags
              └─ SSE → Angular AnalysisService → SessionService

ReviewComponent (from SessionService observables)
  ├─ approve / reject / amend / feedback → SessionService + AuditService
  └─ feedback → POST /api/regenerate → SSE → SessionService.replaceStory()

TasksComponent (per approved story, on-demand)
  └─► POST /api/analyse/tasks → Task[] → SessionService.setTasksForStory()

PublishComponent
  └─► export.service.ts → PublishedBacklog → JSON Blob download
```

---

## API Routes

| Method | Path | Transport | Purpose |
|---|---|---|---|
| POST | `/api/analyse` | SSE stream | PDF/text + optional JSON → analysis events |
| POST | `/api/analyse/tasks` | JSON | Approved story → Task[] |
| POST | `/api/regenerate` | SSE stream | Story or task + feedback → regenerated item |
| POST | `/api/export` | JSON | Server audit validation + download |

**Error codes** (SSE stream payload, not HTTP status):
`PDF_EXTRACT_FAILED`, `PDF_IMAGE_ONLY`, `PDF_TOO_LARGE`, `BACKLOG_SCHEMA_INVALID`,
`AI_TIMEOUT`, `AI_MALFORMED_RESPONSE`

---

## Session State

Managed by `SessionService` (`providedIn: 'root'`). State held in a `BehaviorSubject<SessionState>`.
No `localStorage` or `sessionStorage` — in-memory only. Closing the browser tab clears all state.

Key selectors (RxJS observables):
- `approvedStories$` — stories with status `Approved` or `Amended`
- `canPublish$` — `true` when at least one approved story exists
- `lowConfidenceItems$` — all items with `confidence === 'Low'`

---

## Constitution Compliance

| Principle | Implementation |
|---|---|
| I. Human Oversight | `canPublish$` gates publish; `export.service` filters Draft/Rejected; Low-confidence items require "Acknowledge" before Approve |
| II. Transparency | `rationale` and `confidence` always visible on story/task cards; `promptVersions` in every export |
| III. Privacy | In-memory state only; only extracted text sent to Anthropic API |
| IV. AI Safety | `MODEL_ID` constant; `class-validator` on all AI responses; temperature 0.3 documented in prompt metadata |
| V. Scope Integrity | `sourceSegment` on UserStory traces to input section; regeneration prompt includes original context |

---

## Packaging

```
nx build api   → dist/apps/api/   (NestJS, served at :3000)
nx build web   → dist/apps/web/   (Angular static, served by NestJS ServeStaticModule)
pkg            → dist/backlog-assistant.exe  (Node.js binary + app + static assets embedded)
build-demo.bat → runs all three steps + zips the output
```

Client runs `backlog-assistant.exe`, opens `http://localhost:3000`.

---

## Implementation Order

1. `libs/shared/src/` — entities, enums, DTOs, constants
2. `apps/api/src/ai/ai.service.ts` — Anthropic SDK singleton
3. `apps/api/src/ai/prompts/` — all prompt modules
4. `apps/api/src/pdf/pdf.service.ts` — PDF extraction + segmentation
5. `apps/api/src/analyse/analyse.controller.ts` — SSE orchestrator
6. `apps/api/src/overlap/overlap.service.ts` — duplicate detection
7. `apps/web/src/app/core/session.service.ts` — session state
8. `apps/web/src/app/features/review/` — StoryCard, ConfidenceBadge, OverlapFlag
9. `apps/api/src/export/export.service.ts` — PublishedBacklog assembly

**Post-MVP**: Module Federation micro-frontends — each feature module in
`apps/web/src/app/features/` already has clean boundaries for promotion to a remote.
