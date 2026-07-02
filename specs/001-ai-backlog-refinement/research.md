# Research: AI-Backed Backlog Refinement — MVP1

**Date**: 2026-07-01 | **Phase**: Planning | **Feature**: [spec.md](./spec.md)

All NEEDS CLARIFICATION items resolved. This document records each architectural decision,
its rationale, and the alternatives that were evaluated and rejected.

---

## Decision 1: Frontend Framework

**Decision**: Angular 17 (standalone components)

**Rationale**: TypeScript-first with no opt-in required. Built-in dependency injection maps
cleanly to the service-per-concern pattern (SessionService, AuditService, AnalysisService).
RxJS `BehaviorSubject` and `Observable` are a natural fit for consuming SSE streams and for
reactive session state. Angular Material 17 provides accessible, consistent UI components
with no additional bundle cost.

**Alternatives considered**:
- React + Next.js: Rejected — no Angular ecosystem alignment; Zustand (React-only state
  library) would be needed; Next.js full-stack pattern does not compose with NestJS.
- Vue 3: Rejected — smaller enterprise adoption in Accenture delivery context; less alignment
  with NestJS's Angular-style architecture.

---

## Decision 2: Backend Framework

**Decision**: NestJS 10

**Rationale**: Angular-inspired architecture (modules, decorators, dependency injection) makes
the codebase structurally consistent with the Angular frontend. Built-in `@Sse()` decorator
returns `Observable<MessageEvent>` — native SSE support without custom streaming plumbing.
`@nestjs/platform-express` includes `multer` for multipart file uploads. `class-validator` +
`class-transformer` provide DTO validation at the controller boundary. NestJS compiles to
plain Node.js, making it compatible with `pkg` for Windows exe packaging.

**Alternatives considered**:
- Express.js: Rejected — no built-in structure; would require manual module organisation,
  streaming wrappers, and validation middleware.
- Python FastAPI: Rejected — different runtime from Angular frontend; two runtimes to bundle
  for the Windows exe; no shared TypeScript types with the frontend.
- Next.js API Routes: Rejected — React ecosystem only; does not compose with Angular.

---

## Decision 3: Monorepo Tool

**Decision**: Nx workspace

**Rationale**: Nx supports Angular + NestJS in a single workspace with a shared library
(`libs/shared`) that both apps import. Nx enforces build dependency order, provides
`nx run-many` for parallel test execution, and generates consistent project scaffolding.
The `libs/shared` library holds all entity interfaces, DTOs, enums, and constants — a single
source of truth that eliminates duplicated type definitions between frontend and backend.

**Alternatives considered**:
- Separate repositories: Rejected — requires manual type synchronisation between Angular and
  NestJS; increases setup friction for a demo.
- npm workspaces without Nx: Rejected — no project graph enforcement, no generator tooling,
  no built-in caching.

---

## Decision 4: Frontend Architecture

**Decision**: Angular lazy-loaded feature modules (one per workflow step)

**Rationale**: Each workflow step (input, analysis, review, tasks, publish) is a lazy-loaded
Angular module with its own route, components, and local services. This provides team
isolation and feature boundary discipline equivalent to micro-frontends, without runtime
Module Federation overhead.

Micro-frontend (Module Federation) was explicitly evaluated and rejected for MVP1 for three
reasons: (1) the app has a single linear session — browser-only state must flow across all
steps; MFE boundaries require a shell-level event bus for this; (2) Module Federation loads
remote bundles from runtime URLs, which does not work inside a standalone `pkg` `.exe` with
no remote hosts; (3) there is no multi-team parallelism benefit in a sequential single-reviewer
MVP.

Module Federation remains the documented post-MVP upgrade path. Each feature module already
has clean boundaries (own route, own module, no cross-feature imports) and can be promoted to
a Module Federation remote with minimal refactoring.

**Alternatives considered**:
- Single Angular module (no lazy loading): Rejected — poor initial load performance; no
  feature boundary enforcement for future team scaling.
- Module Federation (micro-frontends): Rejected — see rationale above. See also
  [ADR-002](../../docs/decisions/ADR-002-feature-modules-not-mfe.md).

---

## Decision 5: Session State Management

**Decision**: Angular `SessionService` with RxJS `BehaviorSubject` (in-memory, root-scoped)

**Rationale**: A root-provided Angular service with a `BehaviorSubject<SessionState>` satisfies
the browser-session-only constraint exactly — state lives in memory and is cleared when the
browser tab closes. Selectors are exposed as typed `Observable` streams, which Angular
components consume via the `async` pipe with no manual subscription management. `AuditService`
appends `ReviewAction` records to the same state as mutations occur.

No `localStorage` or `sessionStorage` is used — writing session data to Web Storage would
persist it beyond the intended lifetime and create a data residency surface (constitution
Principle III: Privacy).

**Alternatives considered**:
- NgRx Store: Rejected — significant boilerplate (actions, reducers, effects, selectors) for
  a single-reviewer MVP; no multi-store or time-travel debugging benefit needed here.
- Zustand: Rejected — React-specific library; not available in Angular.
- Component-level state only: Rejected — session data must survive route navigation between
  workflow steps; component state is destroyed on route change.

---

## Decision 6: PDF Parsing

**Decision**: `pdf-parse` (primary) + `unpdf` (fallback)

**Rationale**: `pdf-parse` wraps Mozilla PDF.js and handles text-based PDFs reliably,
returning extracted text and page count. It runs in Node.js (NestJS) with no system
dependencies. `unpdf` uses a different internal parser and handles edge cases that `pdf-parse`
fails on (e.g., malformed cross-reference tables). Both return near-empty strings for
image-only PDFs; the `pdf.service.ts` heuristic (extracted text < 50 characters for a
multi-page PDF) classifies these as `PDF_IMAGE_ONLY` and surfaces the error to the reviewer
(FR-018). Long documents exceeding 5,000 words are segmented on paragraph boundaries; each
story carries a `sourceSegment` reference.

**Alternatives considered**:
- `pdfplumber` / `pypdf` / `pdf2image`: Rejected — Python-only; incompatible with the
  NestJS Node.js runtime.
- `pdf2image` + OCR: Rejected — requires system-level `poppler` installation; unacceptable
  for a portable Windows demo. The spec explicitly states scanned PDFs surface an error.

---

## Decision 7: Overlap Detection

**Decision**: Token-overlap using normalised bag-of-words intersection over union (IoU),
threshold ≥ 0.6

**Rationale**: Runs in-process within `overlap.service.ts` — no additional API call, no
external ML library, no added latency. Normalised BoW IoU on title + description detects
near-duplicates (FR-016, FR-020) with acceptable accuracy for MVP1. False positives on
short stories with common vocabulary are mitigated by applying the threshold only to
title + description concatenated (not just title alone). Stories that match existing backlog
items are flagged `existing_overlap`; within-session duplicates are flagged `session_duplicate`.

**Alternatives considered**:
- Embedding-based semantic similarity (e.g., Anthropic embeddings API): Rejected for MVP1 —
  requires one API call per story pair, adding latency within the 60-second analysis budget.
  This is the natural post-MVP upgrade if token-overlap proves insufficient.
- Exact string matching: Rejected — misses paraphrased duplicates and abbreviation variants.

---

## Decision 8: UI Component Library

**Decision**: Angular Material 17

**Rationale**: First-party Angular library; no bundle overhead beyond what Angular already
includes. Provides accessible components for all UI needs: `mat-card` (story/task cards),
`mat-chip` (confidence badge, overlap flag, priority), `mat-progress-bar` (analysis progress),
`mat-form-field` (amend/feedback text areas), `mat-button`, `mat-dialog` (reject reason
entry). Theming is handled via Angular Material's theming system.

**Alternatives considered**:
- shadcn/ui: Rejected — React-specific; not available in Angular.
- PrimeNG: Rejected — additional dependency with its own theming system; no advantage over
  Angular Material for this use case.
- Custom CSS only: Rejected — accessibility implementation burden; slows MVP delivery.

---

## Decision 9: Testing Strategy

**Decision**: Jest (unit + integration) + Cypress (E2E)

**Rationale**: Nx generates Jest configuration for both Angular (via `jest-preset-angular`)
and NestJS by default. Jest covers: `pdf.service.ts` extractor, `overlap.service.ts` detector,
`export.service.ts` builder, `responseParser` (DTO validation), and Angular component unit
tests. Cypress covers the full end-to-end workflow (upload → analyse → review → publish).

**Alternatives considered**:
- Vitest + Playwright: Rejected — Nx + Angular + NestJS ecosystem defaults to Jest/Cypress;
  switching adds configuration overhead with no testing benefit.
- Karma + Jasmine: Rejected — deprecated in Angular 17; Jest is the Angular team's recommended
  replacement.

---

## Decision 10: Demo Packaging

**Decision**: `pkg` → standalone `backlog-assistant.exe` (~60 MB, Windows x64)

**Rationale**: The demo targets client Windows machines with no prerequisite software. `pkg`
bundles the NestJS compiled output and Node.js binary into a single portable executable.
Angular's static build output (`dist/apps/web/`) is embedded as assets and served by NestJS
via `ServeStaticModule`. The client double-clicks the `.exe` and opens `http://localhost:3000`
in their browser. `build-demo.bat` automates the full build pipeline.

**Alternatives considered**:
- Docker Compose: Rejected — requires Docker Desktop for Windows; cannot assume this is
  installed on the client demo machine.
- Electron: Rejected — ~150 MB package overhead; Electron adds a Chromium runtime and
  build complexity (electron-builder, code signing) for what is functionally a local web app.
- Vercel / cloud deployment: Rejected — client machine demo requires offline capability and
  no dependency on external network or cloud credentials.
