# Research: Process Logging

## Problem

The Smart Backlog Assistant API had zero process logging. On success, services were silent;
on failure, errors surfaced only as SSE events to the client with no durable post-mortem trail.

## Options Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| **winston** | File + console transports built in, level filtering, stable, wide ecosystem | Additional dependency | **Selected** |
| NestJS built-in `Logger` | Zero dependency | Console-only, no file transport | Rejected — no file output |
| `pino` | Very fast | More complex setup for NestJS `LoggerService` wrapper | Rejected — overkill for current volume |
| `log4js` | Configurable | Heavyweight, dated API | Rejected |

## Winston Transport Architecture

Two transports are registered per process start:

1. **Console transport** — colourised output, `simple` format. Human-readable during development
   and `nx serve api` sessions.
2. **File transport** — plain text (no ANSI codes), timestamped filename
   `logs/run-YYYY-MM-DDTHH-mm-ss.log`. One file per process start.

## Log Level Resolution

`process.env.LOG_LEVEL` is read at `AppLogger` construction time. Values are validated against
Winston's level list (`error warn info http verbose debug silly`). Invalid values silently fall
back to `info` to prevent startup failures.

## File Write Failure Safety

The file transport has `handleExceptions: false` and a `.on('error', ...)` handler that emits a
`console.warn`. This ensures a log directory permission problem never crashes the API process.

## NestJS Integration

`AppLogger` implements `LoggerService` and is registered via `app.useLogger()` at bootstrap
(with `bufferLogs: true`). This routes all NestJS internal messages (module load, route
registration, lifecycle hooks) through winston, giving a single log stream for both framework
and application logs.
