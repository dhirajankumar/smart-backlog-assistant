# Tasks: AI-Backed Backlog Refinement — MVP1

**Input**: Design documents from `specs/001-ai-backlog-refinement/`

**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅ contracts/ ✅ research.md ✅ quickstart.md ✅

**Tests**: Unit test tasks generated per user request — write each spec file before the corresponding implementation tasks in the same phase; verify tests FAIL before implementing.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All four user stories (US1–US4) constitute MVP1.

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

### Unit Tests for Foundational Services

> **NOTE: For strict TDD, write T015–T018 before T011–T014 and verify they FAIL; otherwise write them after to validate the implementation**

- [ ] T015 [P] Write unit tests for SessionService in apps/web/src/app/core/session.service.spec.ts: cover INITIAL_STATE shape, startAnalysis resets state + sets status=Analysing, approveStory sets status=Approved, rejectStory sets status=Rejected, amendStory saves originalAiText on first amend only and sets status=Amended, canPublish$ emits true after first approval and false after all stories rejected, buildExport() throws when canPublish is false, reset() restores INITIAL_STATE
- [ ] T016 [P] Write unit tests for AuditService in apps/web/src/app/core/audit.service.spec.ts: cover UUID uniqueness across two consecutive calls, ISO-8601 timestamp format regex, auditLog length increments by 1 per call, no existing entry is modified after append (append-only invariant)
- [ ] T017 [P] Write unit tests for PdfService in apps/api/src/pdf/pdf.service.spec.ts: cover (1) text-based PDF buffer returns extracted text string and segmentCount=1 for ≤5,000 words, (2) multi-page PDF buffer yielding <50 chars extracted returns error code PDF_IMAGE_ONLY, (3) buffer exceeding MAX_PDF_SIZE_BYTES triggers PDF_TOO_LARGE before parsing, (4) text input >5,000 words returns segmentCount>1 with correct sourceSegment indices on each segment
- [ ] T018 [P] Write unit tests for prompt modules in apps/api/src/ai/prompts/requirements-summary.prompt.spec.ts and story-generation.prompt.spec.ts: verify build(ctx) returns non-empty string containing context values, version property matches semver regex /^\d+\.\d+\.\d+$/, prompt.registry.ts exports an object with keys for all four prompt names each mapping to a semver string

**Checkpoint**: Foundation complete — all libs/shared types compile, NestJS and Angular bootstrap without errors; T015–T018 unit tests PASS

---

## Phase 3: User Story 1 — Submit Input for AI Analysis (Priority: P1) 🎯 MVP

**Goal**: Reviewer submits text or PDF (plus optional existing backlog JSON), sees a step-by-step progress indicator, then receives a Key Requirements Summary and draft user stories with confidence indicators, rationale, and overlap flags.

**Independent Test**: Upload a two-page text-based PDF and a 10-item backlog JSON, click Analyse. Verify: (1) progress steps appear in sequence, (2) Key Requirements Summary shows ≥ 2 bullets before any story cards, (3) at least two draft stories appear — each with title, role, benefit, ≥ 2 acceptance criteria, priority, category, confidence, rationale; (4) any story matching an existing item is flagged "Existing overlap". No additional config required.

### Unit Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation tasks T021–T028**

- [ ] T019 [P] [US1] Write failing unit tests for OverlapService in apps/api/src/overlap/overlap.service.spec.ts: cover (1) IoU ≥ 0.6 on title+description sets OverlapFlag.SessionDuplicate between two similar stories, (2) IoU < 0.6 returns OverlapFlag.None, (3) existing backlog item title match sets OverlapFlag.ExistingOverlap with correct reference title string, (4) empty stories array returns empty patches array, (5) empty existingBacklogItems array skips existing overlap detection and returns all None flags
- [ ] T020 [P] [US1] Write failing unit tests for AnalyseService backend in apps/api/src/analyse/analyse.service.spec.ts: cover (1) backlogJson that is not a JSON array emits error event with code BACKLOG_SCHEMA_INVALID, (2) backlogJson array item missing title field emits BACKLOG_SCHEMA_INVALID, (3) analysis completing with zero stories emits complete event with empty story array, (4) AbortSignal cancellation emits error event with code AI_TIMEOUT; mock AiService and PdfService

### Implementation for User Story 1

- [ ] T021 [P] [US1] Create AnalyseDto (inputType, textContent with class-validator decorators) and AnalyseTasksDto (story: UserStory, existingBacklogItems?: ExistingBacklogItem[]) in apps/api/src/analyse/analyse.dto.ts
- [ ] T022 [P] [US1] Implement OverlapService in apps/api/src/overlap/overlap.service.ts: normalised bag-of-words IoU on title+description, OVERLAP_IOU_THRESHOLD = 0.6; detectSessionDuplicates(stories: UserStory[]) → patches session_duplicate flag; detectExistingOverlaps(stories, existing) → patches existing_overlap flag with matching item title
- [ ] T023 [US1] Create AnalyseModule in apps/api/src/analyse/analyse.module.ts: configure MulterModule for multipart/form-data (pdfFile ≤ 10 MB, backlogJson); import AiModule, PdfModule, OverlapModule
- [ ] T024 [US1] Implement AnalyseService in apps/api/src/analyse/analyse.service.ts: orchestrates SSE stream — (1) extract text via PdfService or accept textContent, (2) validate backlogJson → ExistingBacklogItem[], (3) call requirements-summary.prompt → emit summary event, (4) call story-generation.prompt streaming → emit one story event per story, (5) run OverlapService → emit overlap_update events, (6) emit complete; apply 58-second AbortSignal; emit error events with typed codes on failure
- [ ] T025 [US1] Implement AnalyseController in apps/api/src/analyse/analyse.controller.ts: @Sse('/analyse') returning Observable<MessageEvent> from AnalyseService.stream(); POST /analyse/tasks returning Task[] from AnalyseService.generateTasks(dto); both decorated with @UseInterceptors(FileFieldsInterceptor)
- [ ] T026 [US1] Create InputComponent in apps/web/src/app/features/input/: text-area for pasted input, PDF file upload (≤10 MB client-side size check), optional backlog JSON upload with schema hint (FR-021); on submit calls AnalysisService.startAnalysis(formData) and navigates to /analysis route
- [ ] T027 [US1] Implement AnalysisService in apps/web/src/app/core/analysis.service.ts: startAnalysis(formData) opens EventSource to POST /api/analyse, parses typed SSE events, dispatches to SessionService mutations (setRequirementsSummary, appendStory, patchStoryOverlap, setAnalysisComplete, setAnalysisError); regenerate(dto) opens EventSource to POST /api/regenerate
- [ ] T028 [US1] Create AnalysisComponent in apps/web/src/app/features/analysis/: displays step-by-step progress indicator driven by SessionService.status$ (Extracting text → Validating backlog → Analysing requirements → Generating stories → Detecting overlaps → Complete); streams story cards as they arrive via stories$ async pipe; shows Key Requirements Summary from requirementsSummary$ before story list; displays timeout error with retry option on AI_TIMEOUT; shows "no stories extracted" message when stories array is empty at complete

**Checkpoint**: Full US1 working end-to-end — text and PDF inputs produce streamed story cards with progress indicator within 60 seconds; T019–T020 unit tests PASS

---

## Phase 4: User Story 2 — Review and Refine AI-Generated User Stories (Priority: P1)

**Goal**: Reviewer works through draft user stories one by one, applying approve / reject / amend / feedback workflow. No story enters the publish queue without explicit human action. Low-confidence stories require acknowledgement before approval.

**Independent Test**: Given three draft stories (one flagged "Existing overlap"), approve one, amend the priority of the second (verify "Amended — Approved" badge and original AI text preserved), reject the third with a reason (verify removed from publish queue). Review summary shows 1 approved, 1 amended, 1 rejected.

### Unit Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation tasks T032–T038**

- [ ] T029 [P] [US2] Write failing unit tests for ConfidenceBadgeComponent in apps/web/src/app/shared/components/confidence-badge/confidence-badge.component.spec.ts: cover High confidence renders green mat-chip with no warning icon, Medium renders amber mat-chip, Low renders red mat-chip with warning icon; Approve action is disabled when confidence=Low and acknowledged=false, enabled when acknowledged=true
- [ ] T030 [P] [US2] Write failing unit tests for OverlapFlagComponent in apps/web/src/app/shared/components/overlap-flag/overlap-flag.component.spec.ts: cover OverlapFlag.None renders no chip element, ExistingOverlap renders chip with text containing "Existing overlap" and the reference title string, SessionDuplicate renders chip with text containing "Possible duplicate"
- [ ] T031 [P] [US2] Write failing unit tests for StoryCardComponent in apps/web/src/app/features/review/story-card/story-card.component.spec.ts: cover (1) Approve button click emits approve Output event, (2) Reject button click with reason emits reject Output event containing reason string, (3) saving amend emits amend Output event with patch object, (4) originalAiText is preserved in emitted amend event, (5) Feedback+Regenerate button click emits feedback Output event with free-text value, (6) Approve button is disabled until Low-confidence story is acknowledged

### Implementation for User Story 2

- [ ] T032 [P] [US2] Create RegenerateDto (targetType, target: UserStory|Task, feedback, parentStory?, existingBacklogItems?) with class-validator; create apps/api/src/regenerate/regenerate.module.ts importing AiModule and OverlapModule
- [ ] T033 [US2] Implement RegenerateService in apps/api/src/regenerate/regenerate.service.ts: SSE stream — emits progress 'regenerating', calls story-regeneration.prompt with original item + feedback + originalInput context, emits story or task event, runs OverlapService → emits overlap_update, emits complete
- [ ] T034 [US2] Implement RegenerateController in apps/api/src/regenerate/regenerate.controller.ts: @Sse('/regenerate') returning Observable<MessageEvent> from RegenerateService.stream(dto)
- [ ] T035 [P] [US2] Create ConfidenceBadgeComponent in apps/web/src/app/shared/components/confidence-badge/: @Input confidence: Confidence; renders mat-chip with colour (High=green, Medium=amber, Low=red); Low confidence shows warning icon prompting acknowledgement before Approve is enabled
- [ ] T036 [P] [US2] Create OverlapFlagComponent in apps/web/src/app/shared/components/overlap-flag/: @Input flag: OverlapFlag; @Input reference: string|null; renders "Existing overlap" or "Possible duplicate" mat-chip with matching item title when flag is non-None
- [ ] T037 [P] [US2] Create StoryCardComponent in apps/web/src/app/features/review/story-card/: @Input story: UserStory; displays title, role, benefit, acceptance criteria list, priority badge, category, ConfidenceBadgeComponent, OverlapFlagComponent, status badge (Draft/Approved/Amended/Rejected); action buttons: Approve (gated behind Low-confidence Acknowledge), Reject (opens reason dialog), Edit (inline amend of all fields with Save/Cancel), Feedback+Regenerate (text area + button); emits approve, reject, amend, feedback Output events
- [ ] T038 [US2] Create ReviewComponent in apps/web/src/app/features/review/review.component.ts: renders StoryCardComponent list from stories$ async pipe; displays KeyRequirementsSummary with editable reviewer note; shows ReviewSummaryComponent (approved/amended/rejected/pending counts from reviewSummary$); wires StoryCard Output events to SessionService mutations (approveStory, rejectStory, amendStory); wires feedback event to AnalysisService.regenerate() → SessionService.replaceStory(); shows "Proceed to Tasks" button when at least one story is approved

**Checkpoint**: Full US1 + US2 working end-to-end — reviewer can complete approve/reject/amend/regenerate cycle; amended stories retain original AI text; review summary counts are accurate; T029–T031 unit tests PASS

---

## Phase 5: User Story 3 — Review and Refine AI-Generated Tasks (Priority: P2)

**Goal**: For each approved user story, AI generates draft tasks on-demand. Reviewer applies the same approve / reject / amend / feedback workflow to tasks.

**Independent Test**: Navigate to one approved story's task view (triggers POST /api/analyse/tasks). Verify tasks appear with description, priority, category, confidence, rationale. Approve two, reject one with reason, amend one. After actions, only approved and amended tasks remain in the publish queue for that story.

### Unit Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation tasks T041–T043**

- [ ] T039 [P] [US3] Write failing unit tests for AnalyseService.generateTasks in apps/api/src/analyse/analyse.service.spec.ts (extend existing file): cover (1) story.status=Draft throws HttpException with status 422, (2) story.status=Rejected throws 422, (3) story.status=Approved returns Task[] where every task has id, storyId, title, description, priority, category, confidence, rationale, overlapFlag, status=Draft, and promptVersion, (4) AI response failing class-validator schema emits AI_MALFORMED_RESPONSE error; mock AiService and OverlapService
- [ ] T040 [P] [US3] Write failing unit tests for TaskCardComponent in apps/web/src/app/features/tasks/task-card/task-card.component.spec.ts: cover Approve/Reject/Edit/Feedback Output events match StoryCard behaviour equivalently, component template contains no role/benefit/acceptanceCriteria fields, confidence badge and overlap flag sub-components are rendered

### Implementation for User Story 3

- [ ] T041 [US3] Implement generateTasks(dto: AnalyseTasksDto) in apps/api/src/analyse/analyse.service.ts: validates story.status is Approved|Amended (else HTTP 422), calls task-generation.prompt with story context, validates AI response via class-validator, runs OverlapService.detectExistingOverlaps for tasks, returns { tasks: Task[], promptVersion }
- [ ] T042 [P] [US3] Create TaskCardComponent in apps/web/src/app/features/tasks/task-card/: mirrors StoryCardComponent structure but for Task entity (no role/benefit/acceptanceCriteria fields); same action buttons (Approve, Reject, Edit, Feedback+Regenerate); emits approve, reject, amend, feedback Output events
- [ ] T043 [US3] Create TasksComponent in apps/web/src/app/features/tasks/tasks.component.ts: receives storyId from route param; dispatches POST /api/analyse/tasks on first load (shows loading state); renders TaskCardComponent list from tasksForStory$(storyId) async pipe; wires Output events to SessionService task mutations (approveTask, rejectTask, amendTask); wires feedback to AnalysisService.regenerate() with targetType='task' → SessionService.replaceTask(); shows task-complete summary (approved/rejected counts) and "Return to Stories" navigation

**Checkpoint**: US1 + US2 + US3 working end-to-end — task generation triggers on navigation, task review workflow is functionally equivalent to story review; T039–T040 unit tests PASS

---

## Phase 6: User Story 4 — Publish Approved Backlog Items (Priority: P2)

**Goal**: Reviewer publishes the finalized set. System validates human gate (≥ 1 approved story, all included tasks are approved/amended, ≥ 1 audit action). Generates a structured JSON export containing Key Requirements Summary, all approved stories with tasks, and the full audit log.

**Independent Test**: Review at least one story and its tasks. Click Publish, enter reviewer name (optional), confirm. Verify: JSON file downloads; file contains only Approved/Amended stories and tasks; auditLog captures all reviewer actions with ISO-8601 timestamps; rejected items are absent from userStories[]; model and promptVersions fields are populated.

### Unit Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation tasks T046–T050**

- [ ] T044 [P] [US4] Write failing unit tests for ExportService in apps/api/src/export/export.service.spec.ts: cover (1) human gate — zero userStories throws HttpException 422, (2) human gate — userStory with status=Draft throws 422, (3) completeness gate — story tasks[] containing a Task with status=Draft throws 422, (4) audit integrity gate — empty auditLog throws 422, (5) valid PublishedBacklog input returns stamped export with exportId matching UUID regex and exportTimestamp matching ISO-8601 regex, (6) rejected story's ReviewAction entries are present in auditLog but the story itself is absent from userStories[]
- [ ] T045 [P] [US4] Write failing unit tests for PublishComponent in apps/web/src/app/features/publish/publish.component.spec.ts: cover (1) Publish button is disabled and shows "At least one approved story is required" message when canPublish$=false, (2) Publish button is enabled when canPublish$=true, (3) Confirm click triggers ExportService.buildExport() exactly once, (4) "Start New Session" button click calls SessionService.reset() and navigates to /input

### Implementation for User Story 4

- [ ] T046 [P] [US4] Create ExportDto (session: PublishedBacklog with class-validator @ValidateNested) and PublishedBacklogDto in apps/api/src/export/export.module.ts; create ExportModule importing ExportService and ExportController
- [ ] T047 [US4] Implement ExportService in apps/api/src/export/export.service.ts: validate three gates (human gate: userStories ≥ 1 and all status Approved|Amended; completeness: every story's tasks[] contains only Approved|Amended; audit integrity: auditLog ≥ 1 Approve or Amend action — else HTTP 422 on any failure); stamp server-generated exportId (UUID) and exportTimestamp (ISO-8601); return PublishedBacklog or file download response
- [ ] T048 [US4] Implement ExportController in apps/api/src/export/export.controller.ts: POST /export accepts ExportDto, calls ExportService.validate(), returns PublishedBacklog JSON with Content-Disposition header for file download
- [ ] T049 [US4] Implement browser-side export service in apps/web/src/app/features/publish/export.service.ts: buildExport() calls SessionService.buildExport(), POSTs to /api/export, receives stamped PublishedBacklog, triggers JSON Blob download named backlog-export-<exportId>-<timestamp>.json
- [ ] T050 [US4] Create PublishComponent in apps/web/src/app/features/publish/publish.component.ts: optional reviewer name input bound to SessionService.setReviewerName(); Publish button gated by canPublish$ (disabled with "At least one approved story is required" message when false); on confirm calls ExportService.buildExport() and triggers download; displays post-publish confirmation with export filename; "Start New Session" button calls SessionService.reset() and navigates to /input

**Checkpoint**: Full MVP1 end-to-end working — complete workflow from input submission through review to published JSON export with audit log; T044–T045 unit tests PASS

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Packaging, dev-server proxy, and static file serving for demo readiness.

- [ ] T051 [P] Configure ServeStaticModule in apps/api/src/app.module.ts to serve dist/apps/web/browser/ at root path (/) in production; NestJS API routes take precedence over static files
- [ ] T052 [P] Create pkg.config.json: targets node20-win-x64; assets include dist/apps/web/browser/**/* embedded; entry dist/apps/api/main.js; output dist/backlog-assistant.exe
- [ ] T053 [P] Create build-demo.bat: (1) npx nx build api --configuration=production, (2) npx nx build web --configuration=production, (3) pkg dist/apps/api/main.js --config pkg.config.json --output dist/backlog-assistant.exe, (4) create dist/backlog-assistant-demo.zip with exe + one-page README
- [ ] T054 Run all quickstart.md validation scenarios (Scenarios 1–5) and confirm: full happy-path export JSON satisfies all field constraints in "Validating the Export JSON" section; image-only PDF and invalid backlog JSON surface correct error messages; zero-story publish is blocked; `npx nx run-many --target=test` passes all Jest unit tests

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
- T015 [P], T016 [P], T017 [P], T018 [P] run together after T014 (all different spec files)

**Phase 3 (US1)**:
- T019 [P] and T020 [P] run together (write failing tests — different spec files)
- T021 [P] and T022 [P] run together (DTOs + OverlapService — different files)
- T026 [US1] and T027 [US1] run together (InputComponent + AnalysisService — different files)

**Phase 4 (US2)**:
- T029 [P], T030 [P], T031 [P] run together (write failing tests — different spec files)
- T032 [P], T035 [P], T036 [P] run together (RegenerateDto + shared components — no dependencies)
- T033 [US2] and T037 [P] run together (RegenerateService + StoryCardComponent — different layers)

**Phase 5 (US3)**:
- T039 [P] and T040 [P] run together (write failing tests — different spec files)
- T041 [US3] and T042 [P] [US3] run together (backend task generation + TaskCardComponent)

**Phase 6 (US4)**:
- T044 [P] and T045 [P] run together (write failing tests — different spec files)
- T046 [P] and T049 [US4] run together (backend DTO + browser export service — different layers)

**Phase 7**:
- T051 [P], T052 [P], T053 [P] run together (three independent config files)

### Key Intra-Phase Sequences

Within Phase 2: T004 → T006 → T007 → T008/T009 → T010 → T011/T012/T013 → T014 → T015/T016/T017/T018

Within Phase 3: T019/T020 (write failing tests) → T021/T022 → T023 → T024 → T025 (backend); T026/T027 → T028 (frontend, can overlap with backend batches)

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
Batch H (after G):        T015, T016, T017, T018  ← unit tests (FAIL until G complete)
```

### Phase 3 (US1) parallel batches

```
Batch A (after Phase 2):  T019, T020  ← write failing unit tests
Batch B (after A):        T021, T022
Batch C (after T021):     T023
Batch D (after T023):     T024
Batch E (after T024):     T025
Batch F (after Phase 2):  T026, T027  (frontend — can overlap with B/C/D)
Batch G (after T027):     T028
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
T037 → T038 → T039 → T040 → T041 → T042 → T043 → T044 → T045 → T046 → T047 → T048 →
T049 → T050 → T051 → T052 → T053 → T054

---

## Notes

- [P] tasks touch different files with no blocking dependencies — safe to execute simultaneously
- [Story] label maps each task to a specific user story for traceability (constitution Principle V)
- Unit tests MUST be written before their corresponding implementation tasks within the same phase — verify they FAIL first
- Low-confidence acknowledge gate in StoryCardComponent (T037) is a constitution Principle I requirement — do not skip
- MODEL_ID in libs/shared/src/constants/model.ts must be used everywhere — never hardcode the model string (constitution Principle IV)
- Session state is in-memory only — no localStorage, sessionStorage, or server-side persistence (constitution Principle III)
- buildExport() must filter out Draft and Rejected items; ExportService must enforce the same gate server-side (FR-013)
- Prompt version must be recorded in every AI call output and included in PublishedBacklog.promptVersions (constitution Principle IV)
- Each story phase is independently completable and testable — stop at any checkpoint to demo or validate
- Run `npx nx run-many --target=test` to execute all Jest unit tests across api and web apps simultaneously
