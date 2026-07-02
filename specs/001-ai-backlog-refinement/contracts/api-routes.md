# API Route Contracts: AI-Backed Backlog Refinement — MVP1

**Date**: 2026-07-01 | **Feature**: [spec.md](../spec.md)

All routes are implemented in NestJS 10 (`apps/api/src/`). DTOs use `class-validator` +
`class-transformer` for validation at the controller boundary. Shared types are imported from
`libs/shared`.

Base URL (local): `http://localhost:3000/api`

---

## POST /api/analyse

**Controller**: `apps/api/src/analyse/analyse.controller.ts`  
**Service**: `apps/api/src/analyse/analyse.service.ts`  
**Transport**: Server-Sent Events (SSE) via NestJS `@Sse()` decorator  
**Purpose**: Accept primary input (text or PDF) plus optional existing backlog JSON; stream AI
analysis events back to the Angular client.

### Request

Content-Type: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `inputType` | `"text" \| "pdf"` | Yes | Determines which input field is used |
| `textContent` | `string` | When `inputType = "text"` | Pasted plain text |
| `pdfFile` | `File` | When `inputType = "pdf"` | PDF upload, ≤ 10 MB |
| `backlogJson` | `File` | No | JSON file of existing backlog items |

**DTO**: `AnalyseDto` in `apps/api/src/analyse/analyse.dto.ts`

```ts
export class AnalyseDto {
  @IsIn(['text', 'pdf'])
  inputType: 'text' | 'pdf';

  @IsString() @IsOptional()
  textContent?: string;
}
```

File fields are handled by `@nestjs/platform-express` multer interceptor.

### Response

Content-Type: `text/event-stream`

Each SSE message has a `data` field containing a JSON-encoded payload. Event types:

```ts
// Progress step notification
{ type: 'progress', step: 'extracting_text' | 'validating_backlog' | 'analysing_requirements' | 'generating_stories' | 'detecting_overlaps' | 'complete' }

// Key Requirements Summary (emitted once, before stories)
{ type: 'summary', payload: KeyRequirementsSummary }

// A single user story (emitted per story as it completes)
{ type: 'story', payload: UserStory }

// Overlap flag patch (emitted after overlap detection completes)
{ type: 'overlap_update', storyId: string, flag: OverlapFlag, reference: string | null }

// Terminal error
{ type: 'error', payload: { code: string; message: string } }
```

### Error codes

| Code | Trigger |
|---|---|
| `PDF_EXTRACT_FAILED` | pdf-parse and unpdf both throw on the uploaded file |
| `PDF_IMAGE_ONLY` | Extracted text < 50 chars for a multi-page PDF |
| `PDF_TOO_LARGE` | File size exceeds `LIMITS.MAX_PDF_SIZE_BYTES` (10 MB) |
| `BACKLOG_SCHEMA_INVALID` | Uploaded JSON is not an array or objects lack `title` field |
| `AI_TIMEOUT` | Anthropic SDK call exceeds `LIMITS.ABORT_SIGNAL_MS` (58 s) |
| `AI_MALFORMED_RESPONSE` | AI response fails `class-validator` DTO schema validation |

### Processing sequence

1. Extract text from PDF or accept `textContent` directly
2. Validate and parse `backlogJson` into `ExistingBacklogItem[]` (if provided)
3. Call Anthropic SDK: `requirements-summary.prompt` → `KeyRequirementsSummary` → emit `summary`
4. Call Anthropic SDK: `story-generation.prompt` (streaming) → emit one `story` per story
5. Run `overlap.service` → emit `overlap_update` per flagged story
6. Emit `complete`

---

## POST /api/analyse/tasks

**Controller**: `apps/api/src/analyse/analyse.controller.ts`  
**Service**: `apps/api/src/analyse/analyse.service.ts`  
**Transport**: JSON (synchronous)  
**Purpose**: Generate AI draft tasks for a single approved user story. Called on-demand when
the reviewer navigates into a story's task view.

### Request

Content-Type: `application/json`

```ts
export class AnalyseTasksDto {
  @ValidateNested() @Type(() => UserStoryDto)
  story: UserStory;                          // the approved story providing context

  @IsArray() @IsOptional() @ValidateNested({ each: true })
  existingBacklogItems?: ExistingBacklogItem[]; // forwarded from client for overlap detection
}
```

### Response

Content-Type: `application/json` — HTTP 200

```ts
{
  tasks: Task[];
  promptVersion: string;    // version of task-generation.prompt used
}
```

### Errors (HTTP status codes)

| Status | Condition |
|---|---|
| 400 | Invalid `AnalyseTasksDto` (class-validator failure) |
| 422 | Story status is not `Approved` or `Amended` |
| 504 | AI call exceeds timeout |

---

## POST /api/regenerate

**Controller**: `apps/api/src/regenerate/regenerate.controller.ts`  
**Service**: `apps/api/src/regenerate/regenerate.service.ts`  
**Transport**: Server-Sent Events (SSE)  
**Purpose**: Regenerate a single user story or task using the reviewer's free-text feedback.

### Request

Content-Type: `application/json`

```ts
export class RegenerateDto {
  @IsIn(['story', 'task'])
  targetType: 'story' | 'task';

  @ValidateNested()
  target: UserStory | Task;              // the item to regenerate

  @IsString() @MinLength(1)
  feedback: string;                      // reviewer's free-text feedback

  @ValidateNested() @IsOptional()
  parentStory?: UserStory;               // required when targetType = 'task'

  @IsArray() @IsOptional()
  existingBacklogItems?: ExistingBacklogItem[];
}
```

### Response

Content-Type: `text/event-stream`

```ts
{ type: 'progress', step: 'regenerating' }

// One of:
{ type: 'story', payload: UserStory }    // when targetType = 'story'
{ type: 'task',  payload: Task }         // when targetType = 'task'

{ type: 'overlap_update', storyId: string, flag: OverlapFlag, reference: string | null }
{ type: 'complete' }
{ type: 'error', payload: { code: string; message: string } }
```

The regenerated item replaces the original in `SessionService` client-side. The original is
preserved in `UserStory.originalAiText` / `Task.originalAiText` before replacement.

---

## POST /api/export

**Controller**: `apps/api/src/export/export.controller.ts`  
**Service**: `apps/api/src/export/export.service.ts`  
**Transport**: JSON (synchronous)  
**Purpose**: Server-side validation of the assembled `PublishedBacklog` before download.
Adds a server-generated `exportId` and `exportTimestamp`. The Angular client can also
perform the export entirely in-browser via `apps/web/src/app/features/publish/export.service.ts`;
this endpoint is the preferred path for audit compliance.

### Request

Content-Type: `application/json`

```ts
export class ExportDto {
  @ValidateNested() @Type(() => PublishedBacklogDto)
  session: PublishedBacklog;
}
```

### Response

Option A — JSON body (HTTP 200):
```ts
{
  export: PublishedBacklog;    // with server-stamped exportId and exportTimestamp
}
```

Option B — file download (HTTP 200):
```
Content-Disposition: attachment; filename="backlog-export-<exportId>-<timestamp>.json"
Content-Type: application/json
```

### Validation gates (HTTP 422 if any fail)

| Gate | Rule |
|---|---|
| Human gate | `userStories` must contain ≥ 1 item; all must have `status: Approved \| Amended` |
| Completeness | Every story's `tasks[]` contains only `status: Approved \| Amended` items |
| Audit integrity | `auditLog` contains at least one `Approve` or `Amend` action |

---

## Shared Error Response Shape

For non-SSE routes (400 / 422 / 504 HTTP errors):

```ts
{
  statusCode: number;
  code: string;        // machine-readable error code
  message: string;     // human-readable description
  timestamp: string;   // ISO-8601
}
```
