# Data Model: Process Logging

## AppLogger Service

`AppLogger` is a NestJS `@Injectable()` that implements `LoggerService`. It is the only
runtime entity introduced by this feature — there is no database table, no persistent schema.

### Constructor Inputs

| Source | Value |
|---|---|
| `process.env.LOG_LEVEL` | Controls verbosity (`error \| warn \| info \| http \| verbose \| debug \| silly`); defaults to `info` |
| `process.cwd()` | Resolves the `logs/` directory relative to the API working directory |
| `new Date()` at construction | Generates the run timestamp for the log filename |

### Log Entry Format

```
[YYYY-MM-DD HH:mm:ss] [LEVEL] [Context] message
```

- `timestamp` — ISO-like wall-clock time
- `LEVEL` — uppercased Winston level (ERROR / WARN / INFO / DEBUG / VERBOSE)
- `Context` — optional NestJS context string (e.g. `AnalyseService`, `AiService`, `Bootstrap`)
- `message` — free-form string; never contains ticket content or PII

### Log File

```
logs/run-YYYY-MM-DDTHH-mm-ss.log
```

- One file per `nx serve api` / process start
- Plain text, no ANSI escape codes
- Directory committed via `logs/.gitkeep`; `logs/*.log` excluded from git

### Environment Variable

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `info` | Set in `.env`; overridable at runtime |
| `PORT` | `3000` | Existing; unchanged |
