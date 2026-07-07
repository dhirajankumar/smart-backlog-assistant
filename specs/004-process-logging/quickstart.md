# Quickstart: Process Logging

## Running the API with Logging

```bash
nx serve api
```

On startup you will see timestamped lines in the terminal:

```
[2026-07-07 14:23:01] [INFO] [NestFactory] Starting Nest application...
[2026-07-07 14:23:01] [INFO] [Bootstrap] Application running on http://localhost:3000/api — logs: /path/to/logs/run-2026-07-07T14-23-01.log
```

The same lines (without ANSI colour codes) are written to `logs/run-YYYY-MM-DDTHH-mm-ss.log`.

## Changing Log Level

Edit `.env`:

```
LOG_LEVEL=debug   # more verbose — includes AI call timing
LOG_LEVEL=warn    # quieter — only warnings and errors
LOG_LEVEL=error   # silent except errors
```

Restart `nx serve api` for the change to take effect.

## Reading a Log File

```bash
cat logs/run-2026-07-07T14-23-01.log
```

Example output for a `/api/analyse` call:

```
[2026-07-07 14:23:15] [INFO] [AnalyseService] Step: extracting_text
[2026-07-07 14:23:15] [INFO] [PdfService] PDF parse start — bytes=45312
[2026-07-07 14:23:15] [INFO] [PdfService] PDF parse complete — words=3201 segments=1
[2026-07-07 14:23:15] [INFO] [AnalyseService] Step: validating_backlog
[2026-07-07 14:23:15] [INFO] [AnalyseService] Step: analysing_requirements
[2026-07-07 14:23:15] [DEBUG] [AiService] AI call start — model=claude-haiku-3-5-20241022
[2026-07-07 14:24:12] [INFO] [AiService] AI call complete — exit=0 duration=57103ms
[2026-07-07 14:24:12] [INFO] [AnalyseService] Step: generating_stories
[2026-07-07 14:24:12] [DEBUG] [AiService] AI call start — model=claude-haiku-3-5-20241022
[2026-07-07 14:25:03] [INFO] [AiService] AI call complete — exit=0 duration=51204ms
[2026-07-07 14:25:03] [INFO] [AnalyseService] Step: detecting_overlaps
[2026-07-07 14:25:03] [INFO] [AnalyseService] Step: complete
```

## Simulating a Log Write Failure

To verify the app does not crash when logs are unwritable:

```bash
# Linux/macOS
chmod 000 logs/
nx serve api
# Expect: console.warn about log file write failure, app continues normally
chmod 755 logs/
```

## Git

`logs/*.log` is excluded from git via `.gitignore`. The `logs/` directory itself is committed
via `logs/.gitkeep`.
