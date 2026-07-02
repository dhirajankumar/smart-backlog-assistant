# ADR-001: Angular + NestJS Nx Monorepo as the Application Stack

## Status

Accepted — 2026-07-01

## Context

Feature 001 (AI-Backed Backlog Refinement MVP1) requires a full-stack web application with:
- A backend that can parse PDFs, call the Anthropic API with streaming, and validate DTOs
- A frontend with reactive state management, SSE consumption, and accessible UI components
- Shared TypeScript entity types between frontend and backend to eliminate duplication
- A single deployable artifact that runs on a client Windows machine without prerequisites

The demo packaging constraint (portable `.exe` via `pkg`) requires the backend to be a
Node.js process. The frontend must be served as static files by that same process.

No prior technology commitments existed — the stack was chosen from scratch during planning.

## Decision

Adopt **Angular 17** (frontend) + **NestJS 10** (backend) in an **Nx workspace** monorepo.

- **Angular** is the frontend framework. Standalone components, built-in dependency injection,
  and RxJS provide the reactive session state and SSE stream consumption the workflow requires.
  Angular Material 17 provides accessible UI components with no additional runtime dependency.

- **NestJS** is the backend framework. Its Angular-inspired architecture (modules, decorators,
  DI) makes the full stack structurally consistent. The built-in `@Sse()` decorator + RxJS
  `Observable<MessageEvent>` handles SSE streaming natively. `class-validator` + `class-transformer`
  handle DTO validation. `ServeStaticModule` serves the Angular static build in production,
  enabling a single-process deployment.

- **Nx workspace** manages the monorepo. The `libs/shared` Nx library holds all entity
  interfaces, DTOs, enums, and constants — imported by both Angular and NestJS — eliminating
  duplicate type definitions and ensuring the frontend and backend always stay in sync.

## Consequences

**Positive**:
- Consistent TypeScript architecture across frontend and backend reduces cognitive overhead
- Shared `libs/shared` types eliminate the class of bugs caused by frontend/backend DTO drift
- NestJS SSE support and Angular RxJS integration reduce streaming boilerplate significantly
- Single Node.js process (NestJS + Angular static) packages cleanly via `pkg` into one `.exe`
- Angular Material satisfies all accessibility requirements without a third-party component library

**Negative / trade-offs**:
- Developers unfamiliar with NestJS's module system face a learning curve compared to Express
- Angular's compile step (Nx build) adds ~30–60 seconds to the local development feedback loop
  compared to a React + Vite setup
- `pkg` bundling of a NestJS app requires care around native modules and dynamic `require()` —
  `pdf-parse` must be listed explicitly in `pkg.config.json` assets

**Out of scope for MVP1**:
- Module Federation micro-frontends — see ADR-002
- Server-side rendering (Angular Universal) — not needed for a local demo exe
