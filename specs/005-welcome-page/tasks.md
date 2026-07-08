# Tasks: Welcome Page with MVP1 Onboarding

**Input**: Design documents from `/specs/005-welcome-page/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/terminal-open.md ✅

**Tests**: Not requested in spec — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[US#]**: Which user story this task belongs to
- All file paths are repo-relative

---

## Phase 1: Setup (Route Registration)

**Purpose**: Wire the `/welcome` route into the Angular app — prerequisite for all three user stories.

- [X] T001 Update `apps/web/src/app/app.routes.ts` — change default redirect from `'input'` to `'welcome'`; add lazy `{ path: 'welcome', loadComponent: () => import('./features/welcome/welcome.component').then(m => m.WelcomeComponent) }` entry

---

## Phase 2: Foundational (Welcome Component Scaffold)

**Purpose**: Create the bare-bones Angular standalone component that all three user story phases build on.

**⚠️ CRITICAL**: All user story phases depend on these files existing.

- [X] T002 Create `apps/web/src/app/features/welcome/welcome.component.ts` — Angular 17 standalone component (`selector: 'app-welcome'`, imports `[CommonModule]`), inject `Router` in constructor, declare three component properties: `isCopied = false`, `terminalLaunching = false`, `terminalError: string | null = null`
- [X] T003 [P] Create `apps/web/src/app/features/welcome/welcome.component.html` — outer wrapper `<div class="welcome-page">` containing three empty section placeholders: `<!-- AUTH SECTION -->`, `<!-- TERMINAL SECTION -->`, `<!-- ROADMAP SECTION -->`
- [X] T004 [P] Create `apps/web/src/app/features/welcome/welcome.component.scss` — base layout: `.welcome-page { max-width: 800px; margin: 48px auto; padding: 0 24px; }`, heading size, subtitle colour `#555`, shared `.section` block with `margin-bottom: 40px`

**Checkpoint**: Navigate to `http://localhost:4200/` — browser should redirect to `/welcome` and render a blank page without console errors.

---

## Phase 3: User Story 1 — Authentication Prerequisite Onboarding (Priority: P1) 🎯 MVP

**Goal**: User sees a welcome heading, the `claude auth login` command displayed prominently, an MVP1/no-API-key explanation, and a "Start Refinement" button that navigates to `/input`.

**Independent Test**: Navigate to `http://localhost:4200/` → land on `/welcome` → read the auth section → click "Start Refinement" → arrive at `/input`. All without scrolling past the fold on a 1080p display.

### Implementation

- [X] T005 [US1] Add auth instructions markup to `apps/web/src/app/features/welcome/welcome.component.html` replacing `<!-- AUTH SECTION -->`: welcome `<h1>`, subtitle paragraph, `<span class="badge">MVP1 Demo Release</span>`, rationale paragraph explaining no API key, `<code class="command">claude auth login</code>` block, and a `<button class="btn-primary" (click)="goToInput()">Start Refinement</button>`
- [X] T006 [US1] Add `goToInput()` method to `apps/web/src/app/features/welcome/welcome.component.ts` — calls `this.router.navigate(['/input'])`
- [X] T007 [P] [US1] Style auth section in `apps/web/src/app/features/welcome/welcome.component.scss` — `.badge` (blue pill, `#1976d2` background), `.command` (monospace code block with `#f5f5f5` background, `1.1rem` font, `16px` padding, `border-radius: 6px`), `.btn-primary` matching the existing submit button style from `input.component.scss` (`background: #1976d2`, hover `#1565c0`, border-radius 4px)

**Checkpoint**: Auth section renders correctly; "Start Refinement" navigates to `/input`. US1 acceptance scenarios 1–3 pass.

---

## Phase 4: User Story 2 — Terminal Launch Assistance (Priority: P2)

**Goal**: An "Open Terminal" button calls `POST /api/terminal/open`; on success a native terminal window opens; on failure a per-platform instruction block is shown. The `claude auth login` command is copyable via a copy button.

**Independent Test**: Click "Open Terminal" → terminal window opens (or fallback instructions appear). Click copy icon → paste into text editor yields exactly `claude auth login` → "Copied!" confirmation shows for ~2 seconds. Verifiable without US3 being implemented.

### Backend — NestJS TerminalModule

- [ ] T008 [US2] Create `apps/api/src/terminal/terminal.service.ts` — `@Injectable()` class `TerminalService` with `openTerminal()` method: detect `process.platform`; on `win32` try `child_process.spawnSync('where', ['wt.exe'])` — if found spawn `wt.exe`, else spawn `cmd.exe /k`; on `darwin` spawn `open -a Terminal`; on `linux` probe `['gnome-terminal','xterm','konsole','xfce4-terminal']` until one resolves; all spawns use `{ detached: true, stdio: 'ignore' }` and call `.unref()`; return `TerminalOpenResponse` with `success`, `platform`, and optional `message`
- [ ] T009 [US2] Create `apps/api/src/terminal/terminal.controller.ts` — `@Controller('terminal')` with `@Post('open')` handler calling `this.terminalService.openTerminal()` and returning its result; wrap in try/catch returning `{ success: false, message: '...' }` on unexpected error
- [ ] T010 [US2] Create `apps/api/src/terminal/terminal.module.ts` — `@Module({ controllers: [TerminalController], providers: [TerminalService] })` class `TerminalModule`
- [ ] T011 [US2] Import `TerminalModule` in `apps/api/src/app/app.module.ts` — add to `imports` array

### Frontend — Copy & Terminal Buttons

- [ ] T012 [P] [US2] Add `openTerminal()` and `copyCommand()` methods to `apps/web/src/app/features/welcome/welcome.component.ts`; inject `HttpClient` in constructor; `openTerminal()` sets `terminalLaunching = true`, posts to `/api/terminal/open`, on response sets `terminalError` from response body, resets `terminalLaunching`; `copyCommand()` calls `navigator.clipboard.writeText('claude auth login')`, sets `isCopied = true`, resets to `false` after 2000 ms via `setTimeout`; add `HttpClient` to constructor and `HttpClientModule` is globally provided (no component-level import needed)
- [ ] T013 [US2] Add terminal assistance markup to `apps/web/src/app/features/welcome/welcome.component.html` replacing `<!-- TERMINAL SECTION -->`: a sub-heading "Step 1 — Run the authentication command", the `claude auth login` command block with a copy `<button (click)="copyCommand()">{{ isCopied ? 'Copied!' : 'Copy' }}</button>`, an "Open Terminal" `<button (click)="openTerminal()" [disabled]="terminalLaunching">{{ terminalLaunching ? 'Opening…' : 'Open Terminal' }}</button>`, and a `@if (terminalError)` fallback block showing OS-specific manual instructions (Windows: Win+R → type `cmd` → Enter; macOS: Cmd+Space → type `Terminal` → Enter; Linux: Ctrl+Alt+T)
- [ ] T014 [P] [US2] Style terminal section in `apps/web/src/app/features/welcome/welcome.component.scss` — `.copy-row` flex row aligning command block and copy button; `.btn-secondary` for "Open Terminal" (outlined variant: `border: 2px solid #1976d2`, white background, blue text); `.fallback-instructions` box (`background: #fff8e1`, `border-left: 4px solid #f9a825`, `padding: 16px`); "Copied!" state colour `#388e3c`

**Checkpoint**: T008–T014 done. Clicking "Open Terminal" opens a terminal (or shows fallback). Clicking copy yields `claude auth login` in clipboard. US2 acceptance scenarios 1–3 pass.

---

## Phase 5: User Story 3 — MVP1 Demo Showcase & Roadmap Section (Priority: P3)

**Goal**: An "MVP1 Release" section with Angular Material tabs shows current features ("Current Features" tab) and upcoming phases ("Coming Soon" tab) as defined in the data model.

**Independent Test**: The roadmap section renders with both tabs. Switching between "Current Features" and "Coming Soon" shows the correct items without a page reload. Verifiable independently of US1/US2 content.

### Implementation

- [X] T015 [P] [US3] Add `RoadmapPhase` interface and `MVP1_ROADMAP` constant to `apps/web/src/app/features/welcome/welcome.component.ts` (copy verbatim from `data-model.md`); expose `currentPhases` and `upcomingPhases` getters returning `MVP1_ROADMAP.filter(p => p.available)` and `MVP1_ROADMAP.filter(p => !p.available)` respectively; add `MatTabsModule` to component `imports` array
- [X] T016 [US3] Add MVP1 roadmap markup to `apps/web/src/app/features/welcome/welcome.component.html` replacing `<!-- ROADMAP SECTION -->`: `<h2>MVP1 Release</h2>`, `<mat-tab-group animationDuration="200ms">` with two `<mat-tab label="...">` children — "Current Features" tab iterates `@for (phase of currentPhases)` showing `phase.label` and `phase.description`; "Coming Soon" tab iterates `@for (phase of upcomingPhases)` showing same fields with a muted style
- [X] T017 [P] [US3] Style roadmap section in `apps/web/src/app/features/welcome/welcome.component.scss` — `.phase-card` for each roadmap item (`padding: 12px 0`, `border-bottom: 1px solid #eee`); phase label bold `0.95rem`; phase description `0.85rem #666`; "Coming Soon" phase label with `color: #9e9e9e`; ensure `mat-tab-group` width is 100%

**Checkpoint**: All three sections visible on the welcome page. Tab switching works. US3 acceptance scenarios 1–4 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across the complete welcome page.

- [ ] T018 [P] Polish `apps/web/src/app/features/welcome/welcome.component.scss` — add section dividers, verify vertical rhythm between the three sections, confirm the page is fully readable at 1280px width (primary target per spec constraints)
- [ ] T019 [P] Update `docs/spec/00-overview.md` — mark feature 005 status as "Implemented" with links to all generated artifacts
- [ ] T020 Run all quickstart.md validation scenarios (Scenarios 1–6) manually against the running app and confirm each passes; record any deviations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 must be done before component files are navigable)
- **Phase 3 (US1)**: Depends on Phase 2 — component files must exist
- **Phase 4 (US2)**: Depends on Phase 2 — backend and frontend work can proceed in parallel with each other
- **Phase 5 (US3)**: Depends on Phase 2 — independent of US1 and US2
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only — no dependency on US2 or US3
- **US2 (P2)**: Depends on Phase 2 only — backend (T008–T011) and frontend (T012–T014) can run in parallel with each other once Phase 2 is done
- **US3 (P3)**: Depends on Phase 2 only — no dependency on US1 or US2

### Within Each User Story

- Phase 3: T005 before T006 (button needs the section to exist); T007 [P] alongside T005/T006
- Phase 4: T008→T009→T010→T011 (sequential NestJS chain); T012 [P] can proceed simultaneously with T008–T011; T013 after T012; T014 [P] alongside T013
- Phase 5: T015 before T016 (template needs the getters); T017 [P] alongside T015/T016

---

## Parallel Execution Examples

### User Story 2 (most parallelism)

```
Parallel group A (backend chain — sequential):
  T008 → T009 → T010 → T011

Parallel group B (frontend — can run alongside group A):
  T012 (component methods) → T013 (template) || T014 (styles)
```

### User Stories 3–5 can start simultaneously after Phase 2

```
After T002–T004:
  Developer A → Phase 3 (US1): T005, T006, T007
  Developer B → Phase 4 (US2): T008–T014
  Developer C → Phase 5 (US3): T015, T016, T017
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational scaffold (T002–T004)
3. Complete Phase 3: US1 auth instructions + "Start Refinement" (T005–T007)
4. **STOP and validate**: navigate to `localhost:4200`, confirm welcome page shows auth instructions and "Start Refinement" works
5. Demo-ready for basic onboarding flow

### Incremental Delivery

1. Setup + Foundational → blank welcome page at `/welcome`
2. Add US1 → auth instructions + "Start Refinement" → MVP demo ready
3. Add US2 → terminal launch + copy button → reduces user friction
4. Add US3 → roadmap tabs → communicates product direction
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files or independent concerns — safe to run in parallel
- [US#] label maps task to specific user story for traceability
- No test tasks generated (not requested in spec)
- Follow existing component style from `input.component.ts` and `input.component.scss` for consistency
- The global `provideHttpClient()` is already wired in `app.config.ts` (used by `AnalysisService`) — `WelcomeComponent` can inject `HttpClient` in its constructor without adding it to the component's `imports` array
- Commit after each phase checkpoint for clean rollback points
