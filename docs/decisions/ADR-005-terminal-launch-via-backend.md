# ADR-005: Terminal Launch via NestJS Backend API

## Status

Accepted — 2026-07-07 (amended 2026-07-07: route guard and localStorage auth-state removed per rev2 plan; welcome page now renders unconditionally)

## Context

The welcome page (Feature 005) must provide a mechanism to help users open a terminal and run `claude auth login` (FR-004). The application is a browser SPA served locally by a NestJS process — the browser's JavaScript context cannot spawn OS processes directly. Three approaches were considered: a browser URI scheme deep link, a fully embedded in-browser terminal (xterm.js), or a backend API endpoint that spawns the native terminal server-side.

## Decision

Implement `POST /api/terminal/open` in a new NestJS `TerminalModule`. The endpoint uses `child_process.spawn` with `detached: true` and `stdio: 'ignore'` to fire-and-forget the OS-native terminal (Windows: `wt.exe` → `cmd.exe` fallback; macOS: `open -a Terminal`; Linux: `gnome-terminal` → `xterm` → `konsole` → `xfce4-terminal`). When the endpoint returns `success: false`, the Angular `WelcomeComponent` displays a static per-platform instruction block (FR-004 graceful degradation).

## Consequences

**Positive**:
- Works on all three target platforms with no browser policy restrictions.
- Satisfies both sides of FR-004 in a single implementation: button for local dev/pkg, instructions for cloud hosting.
- Minimal surface area: one controller, one service, no new npm dependencies.

**Negative**:
- Adds a NestJS module that is only meaningful in local deployments; in cloud-hosted environments `success` is always `false`.
- Users clicking "Open Terminal" send a POST to localhost — expected and benign in local context, but this endpoint must not be exposed in any public deployment.
