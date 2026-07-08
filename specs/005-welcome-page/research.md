# Research: Welcome Page with MVP1 Onboarding

**Feature**: 005-welcome-page | **Date**: 2026-07-07

## Terminal Launch from Browser

**Decision**: Use a NestJS API endpoint (`POST /api/terminal/open`) that spawns the OS-native terminal server-side. The browser calls this endpoint on button click; on failure the UI degrades to per-platform instruction text.

**Rationale**: The application is a browser SPA served by a local NestJS process — `child_process.spawn` is unavailable in the browser's JavaScript context but available in Node.js. This satisfies FR-004 (button where feasible, instructions where not) with graceful degradation built in.

**Platform spawn commands**:
- Windows: detect `wt.exe` (Windows Terminal) first; fall back to `start cmd.exe`
- macOS: `open -a Terminal`
- Linux: probe `['gnome-terminal', 'xterm', 'konsole', 'xfce4-terminal']` in order

The process is spawned with `detached: true` and `stdio: 'ignore'` so NestJS does not wait for the terminal to exit.

**Alternatives Considered**:
- *Custom URI scheme (e.g., `x-terminal-emulator://`)* — rejected: no universal cross-platform scheme; browser security blocks unregistered URI handlers by default.
- *Embedded xterm.js in-browser terminal* — rejected: disproportionate scope per Principle V; requires WebSocket relay server; far exceeds the onboarding use case.
- *Static instruction text only, no button* — rejected: FR-004 explicitly requires a button where technically feasible; the local NestJS backend makes it feasible.

---

## Welcome Page Routing

**Decision**: The application root (`''`) redirects to `/welcome`. The `WelcomeComponent` always renders — there is no condition or flag that suppresses it. The "Start Refinement" button navigates imperatively to `/input` via Angular Router.

**Rationale**: The user requirement is explicit: `/welcome` should always appear. Removing auth-state logic (no localStorage flag, no `CanActivateFn` guard) simplifies the implementation and removes a class of potential bugs (stale flags, guard loops) while fully satisfying FR-010 through a straightforward CTA button.

**Route table (final)**:

| Path | Target | Notes |
|------|--------|-------|
| `` (empty) | — | `redirectTo: 'welcome'` |
| `/welcome` | `WelcomeComponent` | Always rendered; no guard |
| `/input` | `InputComponent` | Reached via "Start Refinement" button |
| `/analysis` | `AnalysisComponent` | Unchanged |
| `/review` | `ReviewComponent` | Unchanged |
| `/tasks/:storyId` | `TasksComponent` | Unchanged |
| `/publish` | `PublishComponent` | Unchanged |

**Alternatives Considered**:
- *localStorage flag + route guard* — rejected by user; adds unnecessary complexity for a demo-mode tool where the welcome page should always be shown.
- *Keep `''→input` redirect, link to welcome from nav* — rejected: contradicts the requirement that `/welcome` is the entry point on every load.

---

## Angular Material Tabs vs Scrollable Layout

**Decision**: Use Angular Material `MatTabsModule` (`mat-tab-group` + `mat-tab`) for the MVP1 roadmap section — "Current Features" tab and "Coming Soon" tab.

**Rationale**: `MatTabsModule` is already installed (`@angular/material` is a project dependency). Tabs are simpler to implement than a bespoke scrollable multi-section layout and match the existing `mode-tabs` pattern established in `InputComponent`.

**Alternatives Considered**:
- *Custom scrollable section with CSS `scroll-snap`* — rejected: more bespoke HTML/CSS without a clear UX advantage.
- *Angular Material Stepper* — rejected: semantically wrong; steppers imply a sequential guided flow, not a content view toggle.

---

## Copy-to-Clipboard

**Decision**: Use `navigator.clipboard.writeText()` (Clipboard API) with no polyfill. Show a 2-second "Copied!" visual confirmation.

**Rationale**: The app is served from localhost (a secure context). The Clipboard API has 97%+ global browser support. No additional dependency is needed.

---

## Edge Case Resolutions

| Edge Case | Resolution |
|-----------|-----------|
| Terminal button fails in cloud deployment | Backend returns `{ success: false }`; UI shows the fallback instruction block (FR-004 satisfied) |
| User skips welcome without running auth | No block — "Start Refinement" navigates to `/input` at any time; no auth enforcement |
| Narrow/mobile screen | Angular Material tab group handles overflow with built-in scroll arrows; max-width container with responsive padding handles layout |
