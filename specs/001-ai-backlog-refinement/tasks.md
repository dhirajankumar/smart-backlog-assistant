# Tasks: AI-Backed Backlog Refinement — MVP1

**Input**: Design documents from `specs/001-ai-backlog-refinement/`

**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅ contracts/ ✅ research.md ✅ quickstart.md ✅

**Tests**: No test tasks generated — not requested in spec.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story. All four user stories (US1–US4) constitute MVP1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All tasks include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Nx monorepo, install all dependencies, verify workspace compiles.

- [ ] T001 Initialize Nx workspace with Angular 17 app (apps/web) and NestJS 10 app (apps/api) matching source tree in plan.md; create nx.json, tsconfig.base.json, root package.json
- [ ] T002 [P] Add backend dependencies to root package.json: @anthropic-ai/sdk, pdf-parse, unpdf, class-validator, class-transformer, @nestjs/serve-static, @nestjs/config, @nestjs/platform-express, multer, uuid
- [ ] T003 [P] Add frontend dependencies to root package.json: @angular/material@17, @angular/cdk@17, uuid; run npm install to confirm no version conflicts

**Checkpoint**: `npx nx serve api` and `npx nx serve web` both start without errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, core services, and bootstrap that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 [P] Create all enums in libs/shared/src/enums/: priority.enum.ts, confidence.enum.ts, status.enum.ts, overlap-flag.enum.ts, action-type.enum.ts, session-status.enum.ts, input-format.enum.ts (exact values from data-model.md)
- [ ] T005 [P] Create constants in libs/shared/src/constants/: model.ts (MODEL_ID = 'claude-sonnet-4-6'), categories.ts (CATEGORIES array + Category type), limits.ts (MAX_PDF_SIZE_BYTES, MAX_WORD_COUNT, ANALYSIS_TIMEOUT_MS, ABORT_SIGNAL_MS, IMAGE_PDF_TEXT_THRESHOLD, OVERLAP_IOU_THRESHOLD, AI_TEMPERATURE)
- [ ] T006 Create all entity interfaces in libs/shared/src/entities/: input-document.entity.ts, existing-backlog-item.entity.ts, key-requirements-summary.entity.ts, user-story.entity.ts, task.entity.ts, review-action.entity.ts, published-backlog.entity.ts, session-state.entity.ts (exact shapes from data-model.md)
- [ ] T007 Create libs/shared/src/index.ts barrel-exporting all enums, entities, and constants; update tsconfig.base.json path alias @smart-backlog/shared → libs/shared/src/index.ts
- [ ] T008 Bootstrap NestJS app: create apps/api/src/main.ts (ValidationPipe globally, CORS, ConfigModule.forRoot), apps/api/src/app.module.ts (import AiModule, AnalyseModule, RegenerateModule, ExportModule, ServeStaticModule placeholder)
- [ ] T009 Bootstrap Angular app: create apps/web/src/main.ts, apps/web/src/app/app.config.ts (provideRouter, provideHttpClient, provideAnimations), apps/web/src/app/app.routes.ts (lazy routes: input, analysis, review, tasks, publish), apps/web/proxy.conf.json (forward /api/* to localhost:3000)
- [ ] T010 Implement AiService in apps/api/src/ai/ai.service.ts: Anthropic SDK singleton, MODEL_ID from constants, 58-second AbortSignal on every call, temperature 0.3; create apps/api/src/ai/ai.module.ts exporting AiService
- [ ] T011 [P] Create prompt modules in apps/api/src/ai/prompts/: requirements-summary.prompt.ts, story-generation.prompt.ts, task-generation.prompt.ts, story-regeneration.prompt.ts (each exports { build(ctx): string, version: string }); create prompt.registry.ts collecting all versions
- [ ] T012 [P] Implement PdfService in apps/api/src/pdf/pdf.service.ts: pdf-parse primary extraction, unpdf fallback, IMAGE_PDF_TEXT_THRESHOLD guard (returns PDF_IMAGE_ONLY code), word-count segmentation at 5,000-word boundary with sourceSegment index; create pdf.validator.ts for file-size check (PDF_TOO_LARGE)
- [ ] T013 [P] Implement AuditService in apps/web/src/app/core/audit.service.ts: log(session, action) generates UUID + ISO-8601 timestamp and appends ReviewAction to SessionState.auditLog via SessionService
- [ ] T014 Implement SessionService in apps/web/src/app/core/session.service.ts: BehaviorSubject<SessionState> initialised to INITIAL_STATE, all public observables (state$, status$, stories$, approvedStories$, pendingStories$, rejectedStories$, tasksForStory$, approvedTasksForStory$, canPublish$, lowConfidenceItems$, reviewSummary$, analysisError$), all mutations (startAnalysis, setRequirementsSummary, appendStory, patchStoryOverlap, setAnalysisComplete, setAnalysisError, approveStory, rejectStory, amendStory, replaceStory, setTasksForStory, approveTask, rejectTask, amendTask, replaceTask, setReviewerName, buildExport, reset) per session-service.md contract

**Checkpoint**: Foundation complete — all libs/shared types compile, NestJS and Angular bootstrap without errors

---

## Phase 3: User Story 1 — Submit Input for AI Analysis (Priority: P1) 🎯 MVP

**Goal**: Reviewer submits text or PDF (plus optional existing backlog JSON), sees a step-by-step
progress indicator, then receives a Key Requirements Summary and draft user stories with confidence
indicators, rationale, and overlap flags.

**Independent Test**: Upload a two-page text-based PDF and a 10-item backlog JSON, click Analyse.
Verify: (1) progress steps appear in sequence, (2) Key Requirements Summary shows ≥ 2 bullets
before any story cards, (3) at least two draft stories appear — each with title, role, benefit, ≥ 2
acceptance criteria, priority, category, confidence, rationale; (4) any story matching an existing
item is flagged "Existing overlap". No additional config required.

### Implementation for User Story 1

- [ ] T015 [P] [US1] Create AnalyseDto (inputType, textContent with class-validator decorators) and AnalyseTasksDto (story: UserStory, existingBacklogItems?: ExistingBacklogItem[]) in apps/api/src/analyse/analyse.dto.ts
- [ ] T016 [P] [US1] Implement OverlapService in apps/api/src/overlap/overlap.service.ts: normalised bag-of-words IoU on title+description, OVERLAP_IOU_THRESHOLD = 0.6; detectSessionDuplicates(stories: UserStory[]) → patches session_duplicate flag; detectExistingOverlaps(stories, existing) → patches existing_overlap flag with matching item title
- [ ] T017 [US1] Create AnalyseModule in apps/api/src/analyse/analyse.module.ts: configure MulterModule for multipart/form-data (pdfFile ≤ 10 MB, backlogJson); import AiModule, PdfModule, OverlapModule
- [ ] T018 [US1] Implement AnalyseService in apps/api/src/analyse/analyse.service.ts: orchestrates SSE stream — (1) extract text via PdfService or accept textContent, (2) validate backlogJson → ExistingBacklogItem[], (3) call requirements-summary.prompt → emit summary event, (4) call story-generation.prompt streaming → emit one story event per story, (5) run OverlapService → emit overlap_update events, (6) emit complete; apply 58-second AbortSignal; emit error events with typed codes on failure
- [ ] T019 [US1] Implement AnalyseController in apps/api/src/analyse/analyse.controller.ts: @Sse('/analyse') returning Observable<MessageEvent> from AnalyseService.stream(); POST /analyse/tasks returning Task[] from AnalyseService.generateTasks(dto); both decorated with @UseInterceptors(FileFieldsInterceptor)
- [ ] T020 [US1] Create InputComponent in apps/web/src/app/features/input/: text-area for pasted input, PDF file upload (≤10 MB client-side size check), optional backlog JSON upload with schema hint (FR-021); on submit calls AnalysisService.startAnalysis(formData) and navigates to /analysis route
- [ ] T021 [US1] Implement AnalysisService in apps/web/src/app/core/analysis.service.ts: startAnalysis(formData) opens EventSource to POST /api/analyse, parses typed SSE events, dispatches to SessionService mutations (setRequirementsSummary, appendStory, patchStoryOverlap, setAnalysisComplete, setAnalysisError); regenerate(dto) opens EventSource to POST /api/regenerate
- [ ] T022 [US1] Create AnalysisComponent in apps/web/src/app/features/analysis/: displays step-by-step progress indicator driven by SessionService.status$ (Extracting text → Validating backlog → Analysing requirements → Generating stories → Detecting overlaps → Complete); streams story cards as they arrive via stories$ async pipe; shows Key Requirements Summary from requirementsSummary$ before story list; displays timeout error with retry option on AI_TIMEOUT; shows "no stories extracted" message when stories array is empty at complete

**Checkpoint**: Full US1 working end-to-end — text and PDF inputs produce streamed story cards with progress indicator within 60 seconds

---

## Phase 4: User Story 2 — Review and Refine AI-Generated User Stories (Priority: P1)

**Goal**: Reviewer works through draft user stories one by one, applying approve / reject / amend /
feedback workflow. No story enters the publish queue without explicit human action. Low-confidence
stories require acknowledgement before approval.

**Independent Test**: Given three draft stories (one flagged "Existing overlap"), approve one,
amend the priority of the second (verify "Amended — Approved" badge and original AI text preserved),
reject the third with a reason (verify removed from publish queue). Review summary shows 1 approved,
1 amended, 1 rejected.

### Implementation for User Story 2

- [ ] T023 [P] [US2] Create RegenerateDto (targetType, target: UserStory|Task, feedback, parentStory?, existingBacklogItems?) with class-validator; create apps/api/src/regenerate/regenerate.module.ts importing AiModule and OverlapModule
- [ ] T024 [US2] Implement RegenerateService in apps/api/src/regenerate/regenerate.service.ts: SSE stream — emits progress 'regenerating', calls story-regeneration.prompt with original item + feedback + originalInput context, emits story or task event, runs OverlapService → emits overlap_update, emits complete
- [ ] T025 [US2] Implement RegenerateController in apps/api/src/regenerate/regenerate.controller.ts: @Sse('/regenerate') returning Observable<MessageEvent> from RegenerateService.stream(dto)
- [ ] T026 [P] [US2] Create ConfidenceBadgeComponent in apps/web/src/app/shared/components/confidence-badge/: @Input confidence: Confidence; renders mat-chip with colour (High=green, Medium=amber, Low=red); Low confidence shows warning icon prompting acknowledgement before Approve is enabled
- [ ] T027 [P] [US2] Create OverlapFlagComponent in apps/web/src/app/shared/components/overlap-flag/: @Input flag: OverlapFlag; @Input reference: string|null; renders "Existing overlap" or "Possible duplicate" mat-chip with matching item title when flag is non-None
- [ ] T028 [P] [US2] Create StoryCardComponent in apps/web/src/app/features/review/story-card/: @Input story: UserStory; displays title, role, benefit, acceptance criteria list, priority badge, category, ConfidenceBadgeComponent, OverlapFlagComponent, status badge (Draft/Approved/Amended/Rejected); action buttons: Approve (gated behind Low-confidence Acknowledge), Reject (opens reason dialog), Edit (inline amend of all fields with Save/Cancel), Feedback+Regenerate (text area + button); emits approve, reject, amend, feedback Output events
- [ ] T029 [US2] Create ReviewComponent in apps/web/src/app/features/review/review.component.ts: renders StoryCardComponent list from stories$ async pipe; displays KeyRequirementsSummary with editable reviewer note; shows ReviewSummaryComponent (approved/amended/rejected/pending counts from reviewSummary$); wires StoryCard Output events to SessionService mutations (approveStory, rejectStory, amendStory); wires feedback event to AnalysisService.regenerate() → SessionService.replaceStory(); shows "Proceed to Tasks" button when at least one story is approved

**Checkpoint**: Full US1 + US2 working end-to-end — reviewer can complete approve/reject/amend/regenerate cycle; amended stories retain original AI text; review summary counts are accurate

---

## Phase 5: User Story 3 — Review and Refine AI-Generated Tasks (Priority: P2)

**Goal**: For each approved user story, AI generates draft tasks on-demand. Reviewer applies the
same approve / reject / amend / feedback workflow to tasks.

**Independent Test**: Navigate to one approved story's task view (triggers POST /api/analyse/tasks).
Verify tasks appear with description, priority, category, confidence, rationale. Approve two, reject
one with reason, amend one. After actions, only approved and amended tasks remain in the publish
queue for that story.

### Implementation for User Story 3

- [ ] T030 [US3] Implement generateTasks(dto: AnalyseTasksDto) in apps/api/src/analyse/analyse.service.ts: validates story.status is Approved|Amended (else 422), calls task-generation.prompt with story context, validates AI response via class-validator, runs OverlapService.detectExistingOverlaps for tasks, returns { tasks: Task[], promptVersion }
- [ ] T031 [P] [US3] Create TaskCardComponent in apps/web/src/app/features/tasks/task-card/: mirrors StoryCardComponent structure but for Task entity (no role/benefit/acceptanceCriteria fields); same action buttons (Approve, Reject, Edit, Feedback+Regenerate); emits approve, reject, amend, feedback Output events
- [ ] T032 [US3] Create TasksComponent in apps/web/src/app/features/tasks/tasks.component.ts: receives storyId from route param; dispatches POST /api/analyse/tasks on first load (shows loading state); renders TaskCardComponent list from tasksForStory$(storyId) async pipe; wires Output events to SessionService task mutations (approveTask, rejectTask, amendTask); wires feedback to AnalysisService.regenerate() with targetType='task' → SessionService.replaceTask(); shows task-complete summary (approved/rejected counts) and "Return to Stories" navigation

**Checkpoint**: US1 + US2 + US3 working end-to-end — task generation triggers on navigation, task review workflow is functionally equivalent to story review

---

## Phase 6: User Story 4 — Publish Approved Backlog Items (Priority: P2)

**Goal**: Reviewer publishes the finalized set. System validates human gate (≥ 1 approved story,
all included tasks are approved/amended, ≥ 1 audit action). Generates a structured JSON export
containing Key Requirements Summary, all approved stories with tasks, and the full audit log.

**Independent Test**: Review at least one story and its tasks. Click Publish, enter reviewer name
(optional), confirm. Verify: JSON file downloads; file contains only Approved/Amended stories and
tasks; auditLog captures all reviewer actions with ISO-8601 timestamps; rejected items are absent
from userStories[]; model and promptVersions fields are populated.

### Implementation for User Story 4

- [ ] T033 [P] [US4] Create ExportDto (session: PublishedBacklog with class-validator @ValidateNested) and PublishedBacklogDto in apps/api/src/export/export.module.ts; create ExportModule importing ExportService and ExportController
- [ ] T034 [US4] Implement ExportService in apps/api/src/export/export.service.ts: validate three gates (human gate: userStories ≥ 1 and all status Approved|Amended; completeness: every story's tasks[] contains only Approved|Amended; audit integrity: auditLog ≥ 1 Approve or Amend action — else 422); stamp server-generated exportId (UUID) and exportTimestamp (ISO-8601); return PublishedBacklog or file download response
- [ ] T035 [US4] Implement ExportController in apps/api/src/export/export.controller.ts: POST /export accepts ExportDto, calls ExportService.validate(), returns PublishedBacklog JSON with Content-Disposition header for file download
- [ ] T036 [US4] Implement browser-side export service in apps/web/src/app/features/publish/export.service.ts: buildExport() calls SessionService.buildExport(), POSTs to /api/export, receives stamped PublishedBacklog, triggers JSON Blob download named backlog-export-<exportId>-<timestamp>.json
- [ ] T037 [US4] Create PublishComponent in apps/web/src/app/features/publish/publish.component.ts: optional reviewer name input bound to SessionService.setReviewerName(); Publish button gated by canPublish$ (disabled with "At least one approved story is required" message when false); on confirm calls ExportService.buildExport() and triggers download; displays post-publish confirmation with export filename; "Start New Session" button calls SessionService.reset() and navigates to /input

**Checkpoint**: Full MVP1 end-to-end working — complete workflow from input submission through review to published JSON export with audit log

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Packaging, dev-server proxy, and static file serving for demo readiness.

- [ ] T038 [P] Configure ServeStaticModule in apps/api/src/app.module.ts to serve dist/apps/web/browser/ at root path (/) in production; NestJS API routes take precedence over static files
- [ ] T039 [P] Create pkg.config.json: targets node20-win-x64; assets include dist/apps/web/browser/**/* embedded; entry dist/apps/api/main.js; output dist/backlog-assistant.exe
- [ ] T040 [P] Create build-demo.bat: (1) npx nx build api --configuration=production, (2) npx nx build web --configuration=production, (3) pkg dist/apps/api/main.js --config pkg.config.json --output dist/backlog-assistant.exe, (4) create dist/backlog-assistant-demo.zip with exe + one-page README
- [ ] T041 Run all quickstart.md validation scenarios (Scenarios 1–5) and confirm: full happy-path export JSON satisfies all field constraints in "Validating the Export JSON" section; image-only PDF and invalid backlog JSON surface correct error messages; zero-story publish is blocked

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 completion (review requires stories from analysis)
- **US3 (Phase 5)**: Depends on Phase 4 completion (tasks linked to approved stories)
- **US4 (Phase 6)**: Depends on Phase 5 completion (publish includes approved tasks)
- **Polish (Phase 7)**: Depends on Phase 6 completion

### Within-Phase Parallel Opportunities

**Phase 2**:
- T004 [P] and T005 [P] run together (enums + constants, no cross-dependency)
- T011 [P], T012 [P], T013 [P] run together after T010 (prompts + PDF + audit — different domains)

**Phase 3 (US1)**:
- T015 [P] and T016 [P] run together (DTOs + OverlapService — different files)
- T020 [US1] and T021 [US1] run together (InputComponent + AnalysisService — different files)

**Phase 4 (US2)**:
- T023 [P], T026 [P], T027 [P] run together (RegenerateDto + shared components — no dependencies)
- T024 [US2] and T028 [P] run together (RegenerateService + StoryCardComponent — different layers)

**Phase 5 (US3)**:
- T030 [US3] (backend task generation) and T031 [P] [US3] (TaskCardComponent) run together

**Phase 6 (US4)**:
- T033 [P] and T036 [US4] run together (backend DTO + browser export service — different layers)

**Phase 7**:
- T038 [P], T039 [P], T040 [P] run together (three independent config files)

### Key Intra-Phase Sequences

Within Phase 2: T004 → T006 → T007 → T008/T009 → T010 → T011/T012/T013 → T014

Within Phase 3: T015/T016 → T017 → T018 → T019 (backend); T020/T021 → T022 (frontend)

---

## Parallel Execution Examples

### Phase 2 parallel batches

```
Batch A (start together): T004, T005
Batch B (after A):        T006
Batch C (after B):        T007
Batch D (after C):        T008, T009
Batch E (after D):        T010
Batch F (after E):        T011, T012, T013
Batch G (after F):        T014
```

### Phase 3 (US1) parallel batches

```
Batch A (after Phase 2):  T015, T016
Batch B (after T015):     T017
Batch C (after all API):  T018
Batch D (after T018):     T019
Batch E (after Phase 2):  T020, T021  (frontend — can overlap with B/C/D)
Batch F (after T021):     T022
```

---

## Implementation Strategy

### Suggested MVP Scope (P1 stories only — US1 + US2)

Phases 1, 2, 3, 4 deliver a complete human-in-the-loop review loop:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 — input + analysis + streaming stories
4. **Validate US1 independently**: text and PDF inputs produce streamed story cards ✓
5. Complete Phase 4: US2 — review workflow (approve/reject/amend/regenerate)
6. **Validate US1 + US2 end-to-end**: full review cycle without publishing ✓
7. **Demo or release as P1 MVP**

### Full MVP1 Delivery

Continue from P1 MVP:

8. Complete Phase 5: US3 — on-demand task generation + task review
9. Complete Phase 6: US4 — publish + JSON export + audit log
10. **Validate end-to-end** using quickstart.md Scenarios 1–5
11. Complete Phase 7: Polish + exe packaging

### Single-Developer Sequential Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 →
T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 →
T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 →
T037 → T038 → T039 → T040 → T041

---

## Notes

- [P] tasks touch different files with no blocking dependencies — safe to execute simultaneously
- [Story] label maps each task to a specific user story for traceability (constitution Principle V)
- Low-confidence acknowledge gate in StoryCardComponent (T028) is a constitution Principle I requirement — do not skip
- MODEL_ID in libs/shared/src/constants/model.ts must be used everywhere — never hardcode the model string (constitution Principle IV)
- Session state is in-memory only — no localStorage, sessionStorage, or server-side persistence (constitution Principle III)
- buildExport() must filter out Draft and Rejected items; ExportService must enforce the same gate server-side (FR-013)
- Prompt version must be recorded in every AI call output and included in PublishedBacklog.promptVersions (constitution Principle IV)
- Each story phase is independently completable and testable — stop at any checkpoint to demo or validate
