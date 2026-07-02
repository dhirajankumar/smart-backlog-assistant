# ADR-002: Angular Lazy-Loaded Feature Modules Instead of Micro-Frontends (MVP1)

## Status

Accepted — 2026-07-01

## Context

Angular 17 supports Module Federation (micro-frontend architecture) via the
`@angular-architects/native-federation` or Webpack Module Federation plugin. The question
arose during planning: should the five workflow steps (input, analysis, review, tasks, publish)
be implemented as independent micro-frontend remotes, or as lazy-loaded Angular feature modules
within a single application?

Micro-frontend architecture is generally motivated by:
1. Independent deployment of UI zones owned by different teams
2. Technology heterogeneity (different frameworks per zone)
3. Isolation of build pipelines to reduce CI/CD coupling

## Decision

Implement the workflow as **Angular lazy-loaded feature modules** for MVP1. Defer
Module Federation micro-frontends to a post-MVP phase.

Each workflow step is a standalone lazy-loaded Angular module:
- `features/input/` — route `/`
- `features/analysis/` — route `/analysis`
- `features/review/` — route `/review`
- `features/tasks/` — route `/review/tasks/:storyId`
- `features/publish/` — route `/publish`

Each module has its own routing, components, and local services. No module imports
components or services from another feature module directly.

## Rationale for Rejecting Micro-Frontends in MVP1

**Session state incompatibility**: The spec mandates browser-session-only state. The entire
review session — stories, tasks, audit log — must flow through all five steps without server
persistence. Module Federation remotes run in isolated JavaScript contexts; sharing a
`BehaviorSubject<SessionState>` across MFE boundaries requires a shell-level event bus or
a shared singleton injected via a custom mechanism. This is significant complexity for a
workflow that is inherently sequential and single-user.

**Windows exe packaging incompatibility**: Module Federation loads remote entry bundles from
runtime URLs (e.g., `http://localhost:4201/remoteEntry.js`). A `pkg`-compiled `.exe` has no
remote hosts. All five modules must be present in the single binary. Forcing all MFE remotes
into the same build collapses the architecture back to a monolith — the isolation benefit
disappears while the configuration overhead remains.

**No team parallelism benefit at MVP1 scale**: The primary delivery benefit of MFE is enabling
independent teams to deploy their zone without coordinating with other teams. MVP1 is built by
a single team with a sequential UX — there is no scenario where two teams need to deploy the
review step and the tasks step independently at this stage.

## Upgrade Path

The feature module boundaries established in MVP1 are designed for straightforward promotion
to Module Federation remotes when the product scales:

1. Each feature module is already isolated (own route, own module file, no cross-module imports)
2. `SessionService` is the only cross-feature dependency — it can be moved to a shell-level
   shared singleton that Module Federation remotes consume via a custom provider
3. When a second team takes ownership of a feature module, converting it to a remote is a
   configuration change in `webpack.config.js` (or `federation.config.js`) plus extracting the
   `SessionService` bridge — no component rewrites required

## Consequences

**Positive**:
- Simpler build configuration — standard Nx + Angular CLI, no Module Federation plugin
- `pkg` exe packaging works with a single Angular build output
- `BehaviorSubject<SessionState>` flows naturally across lazy-loaded routes without a bridge
- Feature module boundaries provide the same developer isolation discipline as MFE

**Negative / trade-offs**:
- All five feature modules are bundled and deployed together — a change to one module requires
  rebuilding and redeploying the full Angular app
- No technology heterogeneity — all features must use Angular; a React-based feature module
  is not possible within this architecture
