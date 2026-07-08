# Contract: POST /api/terminal/open

**Feature**: 005-welcome-page | **Defined**: 2026-07-07

## Overview

Opens the OS-native terminal application on the user's local machine. The process is spawned detached and fire-and-forget — NestJS does not block waiting for terminal exit. Used by the welcome page "Open Terminal" button (FR-004).

## Endpoint

```
POST /api/terminal/open
```

## Request

No request body. No authentication required — local-only endpoint (not exposed in production cloud deployments by design).

## Response

### 200 OK — Success

```json
{
  "success": true,
  "platform": "win32"
}
```

`platform` is one of: `"win32"`, `"darwin"`, `"linux"`.

### 200 OK — Unsupported or Failed

Returned when the platform is unsupported, no terminal emulator is found, or the spawn command fails at the OS level.

```json
{
  "success": false,
  "platform": "linux",
  "message": "No supported terminal emulator found (tried: gnome-terminal, xterm, konsole, xfce4-terminal)"
}
```

### 500 Internal Server Error

Returned for unexpected errors (e.g., `child_process` module unavailable).

```json
{
  "success": false,
  "message": "Unexpected error spawning terminal"
}
```

## Platform Spawn Strategy

| Platform | Primary command | Fallback |
|----------|----------------|---------|
| `win32` | `wt.exe` (Windows Terminal, if present on PATH) | `cmd.exe /k` |
| `darwin` | `open -a Terminal` | none |
| `linux` | `gnome-terminal` | `xterm`, `konsole`, `xfce4-terminal` (probed in order) |

Spawn options: `{ detached: true, stdio: 'ignore' }`. The child process is unref'd so NestJS can exit independently.

## Frontend Handling

On `success: true` → no further action (terminal window opens in the OS).  
On `success: false` or HTTP error → set `terminalError`, show `showFallbackInstructions = true`.

## Constraints

- This endpoint is only meaningful in local-server deployments (packaged `pkg` binary or `nx serve`). In cloud-hosted environments `success` will always be `false`.
- No rate limiting — single-user onboarding flow.
- No request body schema validation required.
