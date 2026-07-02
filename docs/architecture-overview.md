# Architecture Overview — Smart Backlog Assistant MVP1

**Feature**: AI-Backed Backlog Refinement | **Stack**: Angular 17 + NestJS 10 (Nx monorepo)
**Updated**: 2026-07-01

---

## 1. Main Components

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         Nx Monorepo Workspace                               ║
║                                                                              ║
║  ┌─────────────────────────────────┐   ┌────────────────────────────────┐  ║
║  │       apps/web  (Angular 17)    │   │      apps/api  (NestJS 10)     │  ║
║  │                                 │   │                                │  ║
║  │  ┌───────────────────────────┐  │   │  ┌────────────────────────┐   │  ║
║  │  │   Lazy-Loaded Features    │  │   │  │     NestJS Modules      │   │  ║
║  │  │                           │  │   │  │                        │   │  ║
║  │  │  /           InputModule  │  │   │  │  AnalyseModule         │   │  ║
║  │  │  /analysis  AnalysisModule│  │   │  │  RegenerateModule      │   │  ║
║  │  │  /review    ReviewModule  │  │   │  │  ExportModule          │   │  ║
║  │  │  /tasks     TasksModule   │  │   │  │  AiModule          ★   │   │  ║
║  │  │  /publish   PublishModule │  │   │  │  PdfModule             │   │  ║
║  │  └───────────────────────────┘  │   │  │  OverlapModule         │   │  ║
║  │                                 │   │  └────────────────────────┘   │  ║
║  │  ┌───────────────────────────┐  │   │                                │  ║
║  │  │     Core Services         │  │   │  ┌────────────────────────┐   │  ║
║  │  │                           │  │   │  │  Static File Server    │   │  ║
║  │  │  SessionService           │  │   │  │  (ServeStaticModule)   │   │  ║
║  │  │    BehaviorSubject state  │  │   │  │  serves apps/web build │   │  ║
║  │  │  AuditService             │  │   │  └────────────────────────┘   │  ║
║  │  │    append-only log        │  │   └────────────────────────────────┘  ║
║  │  │  AnalysisService          │  │                                        ║
║  │  │    EventSource / SSE      │  │   ┌────────────────────────────────┐  ║
║  │  └───────────────────────────┘  │   │       libs/shared  (Nx lib)    │  ║
║  │                                 │   │                                │  ║
║  │  ┌───────────────────────────┐  │   │  entities/   interfaces        │  ║
║  │  │   Angular Material 17     │  │   │  dtos/       request/response  │  ║
║  │  │   (UI components)         │  │   │  enums/      Priority etc.     │  ║
║  │  └───────────────────────────┘  │   │  constants/  MODEL_ID, LIMITS  │  ║
║  └─────────────────────────────────┘   └────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
              │  localhost:3000                        │
              │  (browser)                             │  HTTPS
              │                                        ▼
              │                          ┌─────────────────────────┐
              │                          │   Anthropic Claude API  │
              │                          │   model: claude-sonnet  │
              │                          │         -4-6     ★      │
              │                          └─────────────────────────┘
              ▼
 ┌─────────────────────────────┐
 │  dist/backlog-assistant.exe │   ← pkg bundles NestJS + Angular +
 │  (~60 MB, Windows x64)      │     Node.js runtime into one file
 └─────────────────────────────┘

★  = AI integration point
```

---

## 2. Data Flow Through the System

```
  REVIEWER                  ANGULAR (browser)              NESTJS (local server)         CLAUDE API
     │                            │                                │                          │
     │  paste text / upload       │                                │                          │
     │  PDF + optional JSON  ───► │                                │                          │
     │                            │                                │                          │
     │                            │  POST /api/analyse             │                          │
     │                            │  multipart/form-data      ───► │                          │
     │                            │                                │                          │
     │                            │                                │  pdf-parse               │
     │                            │                                │  extracts text           │
     │                            │                                │                          │
     │                            │                                │  class-validator         │
     │                            │                                │  validates backlog JSON  │
     │                            │                                │                          │
     │                            │                                │  ── requirements ──────► │
     │                            │                                │     summary prompt       │
     │                            │  ◄── SSE: progress ────────── │  ◄── summary JSON ─────  │
     │  "Analysing requirements"  │                                │                          │
     │  ◄─────────────────────── │                                │  ── story generation ──► │
     │                            │  ◄── SSE: story (×N) ──────── │  ◄── streaming JSON ──── │
     │  story cards appear        │                                │     (one story at a time)│
     │  one by one ◄──────────── │                                │                          │
     │                            │  ◄── SSE: overlap_update ──── │  overlap.service         │
     │                            │                                │  (in-process, no AI)     │
     │                            │  ◄── SSE: complete ─────────  │                          │
     │                            │                                │                          │
     │                            │  SessionService.appendStory()  │                          │
     │                            │  SessionService.patchOverlap() │                          │
     │                            │                                │                          │
     │  ── Approve story ──────► │  SessionService.approveStory() │                          │
     │                            │  AuditService.log()            │                          │
     │                            │                                │                          │
     │  ── Reject story ───────► │  SessionService.rejectStory()  │                          │
     │       + reason             │  AuditService.log()            │                          │
     │                            │                                │                          │
     │  ── Amend story ────────► │  SessionService.amendStory()   │                          │
     │       edit fields          │  (saves originalAiText first)  │                          │
     │                            │  AuditService.log()            │                          │
     │                            │                                │                          │
     │  ── Feedback ───────────► │  POST /api/regenerate     ───► │  ── regen prompt ──────► │
     │                            │  ◄── SSE: story (revised) ─── │  ◄── streaming JSON ──── │
     │  revised story appears ◄─ │  SessionService.replaceStory() │                          │
     │                            │                                │                          │
     │  ── View tasks ─────────► │  POST /api/analyse/tasks  ───► │  ── task generation ───► │
     │       (on-demand)          │  ◄── JSON: Task[] ─────────── │  ◄── JSON ─────────────  │
     │  task cards appear ◄───── │  SessionService                │                          │
     │                            │    .setTasksForStory()         │                          │
     │                            │                                │                          │
     │  ── Publish ────────────► │  export.service                │                          │
     │       + reviewer name      │    .buildExport()              │                          │
     │                            │  (approved + amended only)     │                          │
     │  JSON file downloads ◄─── │  Blob download                 │                          │
     │                            │  (browser-native, no server)   │                          │
     ▼                            ▼                                ▼                          ▼

  Session ends when browser tab closes — no data persisted server-side
```

---

## 3. Where AI Is Used

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     AI Integration Map  (★ = Claude API call)           │
  └─────────────────────────────────────────────────────────────────────────┘

  WORKFLOW STEP          AI CALL                      OUTPUT
  ─────────────────────────────────────────────────────────────────────────

  ① Input submitted
         │
         ▼
  ② Text extraction ──── NOT AI ──── pdf-parse + unpdf (Node.js libraries)
         │
         ▼
  ③ Requirements       ★ CLAUDE API                  KeyRequirementsSummary
    Summary              requirements-summary          • bulleted list of
    generation           .prompt v1.0.0                  identified requirements
         │               (single call, sync)           • displayed before stories
         ▼
  ④ User Story         ★ CLAUDE API                  UserStory[] (streamed)
    Generation           story-generation              • title, role, benefit
         │               .prompt v1.0.0                • acceptance criteria
         │               (streaming)                   • priority, category
         │                                             • confidence, rationale
         │               temperature: 0.3
         │               model: claude-sonnet-4-6
         ▼
  ⑤ Overlap detection ─── NOT AI ──── overlap.service (token-overlap IoU)
         │                             runs in-process, no API call
         ▼
  ⑥ Human review       ─── NOT AI ──── reviewer acts on each story
    (Approve/Reject/
     Amend/Feedback)
         │
         │  [if Feedback given]
         ▼
  ⑦ Story              ★ CLAUDE API                  UserStory (revised)
    Regeneration         story-regeneration            • incorporates reviewer
         │               .prompt v1.0.0                  feedback
         │               (streaming)                   • retains structured format
         │               includes original story
         │               + reviewer feedback
         ▼
  ⑧ Task generation    ★ CLAUDE API                  Task[] per story
    (on-demand,          task-generation               • description, priority
     per approved         .prompt v1.0.0                • category, confidence
     story)              (single call, sync)            • rationale
         │
         ▼
  ⑨ Task review        ─── NOT AI ──── reviewer acts on each task
    (same workflow
     as stories)
         │
         ▼
  ⑩ Publish            ─── NOT AI ──── export.service assembles JSON
                                        no AI call at publish time

  ─────────────────────────────────────────────────────────────────────────
  AI SAFEGUARDS applied to every ★ call:

  • Model pinning     MODEL_ID = 'claude-sonnet-4-6'  (constant, not configurable)
  • Fail-safe         class-validator rejects malformed AI responses → reviewer notified
  • Confidence gate   Low-confidence outputs flagged; Approve button blocked until
                      reviewer clicks "Acknowledge"
  • Prompt versions   Every AI output carries the prompt version that produced it
  • Temperature       0.3 (bounded non-determinism; value recorded in export metadata)
  • Scope guard       Regeneration prompt includes original story to prevent silent
                      scope expansion (constitution Principle V)
  ─────────────────────────────────────────────────────────────────────────

  SUMMARY: 4 AI call types across the workflow

  ┌──────────────────────────────┬──────────────┬──────────┬────────────────┐
  │ Call                         │ Transport    │ Trigger  │ Constitution   │
  ├──────────────────────────────┼──────────────┼──────────┼────────────────┤
  │ Requirements Summary         │ Sync (JSON)  │ Auto     │ Pinned, versioned│
  │ Story Generation             │ Streaming    │ Auto     │ Pinned, versioned│
  │ Story Regeneration           │ Streaming    │ On feedback│ Pinned, versioned│
  │ Task Generation              │ Sync (JSON)  │ On-demand│ Pinned, versioned│
  └──────────────────────────────┴──────────────┴──────────┴────────────────┘
```

---

## References

- Approved plan: [`specs/001-ai-backlog-refinement/plan.md`](../specs/001-ai-backlog-refinement/plan.md)
- Data model: [`specs/001-ai-backlog-refinement/data-model.md`](../specs/001-ai-backlog-refinement/data-model.md)
- API contracts: [`specs/001-ai-backlog-refinement/contracts/api-routes.md`](../specs/001-ai-backlog-refinement/contracts/api-routes.md)
- ADR-001 (stack): [`docs/decisions/ADR-001-angular-nestjs-nx.md`](decisions/ADR-001-angular-nestjs-nx.md)
- ADR-003 (AI safety): [`docs/decisions/ADR-003-model-pinning.md`](decisions/ADR-003-model-pinning.md)
