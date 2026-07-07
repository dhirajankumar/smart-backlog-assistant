# Smart Backlog Assistant — Project Overview

**Last Updated**: 2026-07-07
**Current Phase**: Implementation In Progress — Feature 001 Phases 1–2 complete, Phase 7 polish done; Feature 004 process logging now implemented
**Status**: In Progress — Branch `mvp1/pdf-service`

## What This Project Is

Smart Backlog Assistant is an AI-backed backlog refinement tool that analyses tickets, meeting
notes, and requirement documents to generate draft user stories and tasks. It uses a
human-in-the-loop review workflow — reviewers approve, reject, amend, or provide feedback
before any item is published to the backlog.

**Target**: Portable Windows demo application (`backlog-assistant.exe`) built on Angular 17 +
NestJS 10 in an Nx monorepo. Packaged via `pkg` — no install required on the client machine.

## Active Features

| # | Feature | Status | Artifacts |
|---|---------|--------|-----------|
| 001 | AI-Backed Backlog Refinement — MVP1 | **In Progress** — Phases 1–2 complete (T001–T014 ✅: Nx setup, shared types, NestJS bootstrap with ValidationPipe+CORS+ConfigModule, Angular bootstrap with all 5 lazy routes, AiService, PdfService with pdf-parse+unpdf fallback, all prompt modules, SessionService, AuditService); Phases 3–4 (US1+US2) complete; Phase 7 polish infrastructure done (T038–T040 ✅); Phases 5–6 (T030–T037) and T041 validation pending | [spec](../../specs/001-ai-backlog-refinement/spec.md) · [plan](../../specs/001-ai-backlog-refinement/plan.md) · [data model](../../specs/001-ai-backlog-refinement/data-model.md) · [API contracts](../../specs/001-ai-backlog-refinement/contracts/api-routes.md) · [tasks](../../specs/001-ai-backlog-refinement/tasks.md) · [quickstart](../../specs/001-ai-backlog-refinement/quickstart.md) |
| 002 | UI Results Display | Draft — Spec complete | [spec](../../specs/002-ui-results-display/spec.md) |
| 003 | MCP Integration and Custom Skills — MVP2 | **Tasks generated** — ready for `/speckit-implement` | [spec](../../specs/003-mcp-custom-skills/spec.md) · [tasks](../../specs/003-mcp-custom-skills/tasks.md) |
| 004 | Process Logging | **Implemented** — winston `AppLogger` (US1 terminal output, US2 file per run, US3 level filtering) wired across all services | [spec](../../specs/004-process-logging/spec.md) · [research](../../specs/004-process-logging/research.md) · [data model](../../specs/004-process-logging/data-model.md) · [quickstart](../../specs/004-process-logging/quickstart.md) |

## Approved Tech Stack (Feature 001)

| Layer | Technology |
|---|---|
| Monorepo | Nx workspace |
| Frontend | Angular 17 (standalone components) |
| Backend | NestJS 10 |
| Shared types | `libs/shared` (Nx library) |
| AI SDK | Anthropic TypeScript SDK (`@anthropic-ai/sdk`) |
| Session state | Angular `SessionService` + RxJS `BehaviorSubject` (in-memory) |
| PDF parsing | `pdf-parse` + `unpdf` fallback |
| UI components | Angular Material 17 |
| Testing | Jest + Cypress |
| Demo packaging | `pkg` → `backlog-assistant.exe` |

## SDLC Phase Documents

| Phase | Document | Status |
|-------|----------|--------|
| 01 Discovery | [01-discovery.md](01-discovery.md) | Not started |
| 02 Architecture | [02-architecture.md](02-architecture.md) | **Complete** — Feature 001 plan + tasks approved |
| 03 Prototype | [03-prototype.md](03-prototype.md) | Not started |
| 04 Build | [04-build.md](04-build.md) | **In Progress** — Phase 1 complete (Nx workspace, Angular 17 + NestJS 10 scaffolded, all deps installed, builds verified) |
| 05 Testing | [05-testing.md](05-testing.md) | Not started |
| 06 Release | [06-release.md](06-release.md) | Not started |

## Architecture Decisions

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](../../docs/decisions/ADR-001-angular-nestjs-nx.md) | Angular + NestJS Nx monorepo as the application stack | Accepted |
| [ADR-002](../../docs/decisions/ADR-002-feature-modules-not-mfe.md) | Angular lazy-loaded feature modules instead of micro-frontends (MVP1) | Accepted |
| [ADR-003](../../docs/decisions/ADR-003-model-pinning.md) | AI model pinning and prompt versioning policy | Accepted |
| [ADR-004](../../docs/decisions/ADR-004-pdf-parse-library.md) | PDF parsing — pdf-parse with unpdf fallback | Accepted |

## Governance

Project principles: [constitution.md](../../.specify/memory/constitution.md) (v1.1.0)
