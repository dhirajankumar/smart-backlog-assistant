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

## 3. Places where AI model is called in the funcationality.


---

## References

- Approved plan: [`specs/001-ai-backlog-refinement/plan.md`](../specs/001-ai-backlog-refinement/plan.md)
- Data model: [`specs/001-ai-backlog-refinement/data-model.md`](../specs/001-ai-backlog-refinement/data-model.md)
- API contracts: [`specs/001-ai-backlog-refinement/contracts/api-routes.md`](../specs/001-ai-backlog-refinement/contracts/api-routes.md)
- ADR-001 (stack): [`docs/decisions/ADR-001-angular-nestjs-nx.md`](decisions/ADR-001-angular-nestjs-nx.md)
- ADR-003 (AI safety): [`docs/decisions/ADR-003-model-pinning.md`](decisions/ADR-003-model-pinning.md)
