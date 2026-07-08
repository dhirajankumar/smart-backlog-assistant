# Implementation Plan: Welcome Page with MVP1 Onboarding

**Branch**: `feat/welcome-page` | **Date**: 2026-07-07 | **Spec**: [specs/005-welcome-page/spec.md](spec.md)

**Input**: Feature specification from `/specs/005-welcome-page/spec.md`

**Amendments**: `/welcome` always shows on every visit (no auth-state skip). "Start Refinement" button navigates to `/input`. No localStorage flag or route guard.

## Summary

A welcome page that is always displayed at `/welcome` (the application root redirects here). It instructs users to run `claude auth login` in a terminal, provides assisted terminal access via a NestJS backend endpoint (with graceful fallback to per-platform instructions), includes a copy-to-clipboard control for the command, and presents an MVP1 roadmap in Angular Material tabs. A "Start Refinement" button navigates to `/input`.

## Technical Context

**Language/Version**: TypeScript 5.2

**Primary Dependencies**: Angular 17 (standalone components), Angular Material 17 (`MatTabsModule`, `MatIconModule`, `MatButtonModule`), RxJS 7.8, NestJS 10

**Storage**: None — no localStorage, no server-side session required. The welcome page shows unconditionally on every visit.

**Testing**: Jest 29 (`jest-preset-angular` for Angular components; `ts-jest` for NestJS `TerminalService`)

**Target Platform**: Browser SPA served locally by NestJS (`localhost:3000`); terminal launch handled via backend API since `child_process.spawn` is unavailable in the browser context

**Project Type**: Web application (Angular 17 frontend + NestJS 10 backend), Nx monorepo

**Performance Goals**: Page fully readable within 2 seconds of first load (SC-005)

**Constraints**:
- Terminal cannot be spawned from the browser — backend NestJS API required for FR-004
- `navigator.clipboard.writeText()` requires HTTPS or localhost (satisfied in local dev and `pkg` deployment)
- No new component libraries beyond Angular Material 17 (already installed)
- Mobile responsiveness is a stretch goal; primary target is 1024px+ desktop widths

**Scale/Scope**: Single-user local tool; no persistence layer required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Human Oversight | No AI-generated outputs on this page; no backlog mutations triggered | PASS |
| II. Transparency & Explainability | No AI suggestions presented; page is purely informational UI | PASS |
| III. Privacy & IP | No user data collected or stored | PASS |
| IV. AI Safety & Behavior | No AI model interaction in this feature | PASS |
| V. Scope Integrity | All requirements traceable to FR-001–FR-010; terminal endpoint is the minimal implementation of FR-004; FR-010 satisfied by "Start Refinement" button navigating to `/input` | PASS |

**Gate Result: PASS** — No violations. Proceed to Phase 0 research.

*Post-design re-check*: Gate remains PASS. Removal of auth-state logic (localStorage + route guard) reduces scope vs. the original plan; no new scope introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-welcome-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── terminal-open.md # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/src/app/
├── app.routes.ts                          # MODIFIED: '' redirects to 'welcome'; add /welcome route
├── features/
│   └── welcome/                           # NEW — User Stories 1, 2, 3
│       ├── welcome.component.ts
│       ├── welcome.component.html
│       └── welcome.component.scss

apps/api/src/
└── terminal/                              # NEW NestJS module (FR-004)
    ├── terminal.module.ts
    ├── terminal.controller.ts
    └── terminal.service.ts

apps/api/src/app/
└── app.module.ts                          # MODIFIED: import TerminalModule
```

**Structure Decision**: Web application layout. The Angular `features/welcome/` directory follows the existing convention (`features/input/`, `features/analysis/`, etc.). The NestJS `terminal/` module follows the existing `analyse/` module pattern. No route guard files are created — the welcome page renders unconditionally.

## Complexity Tracking

> No constitution violations to justify. Table left empty intentionally.
