# Session Service Contract: AI-Backed Backlog Refinement — MVP1

**Date**: 2026-07-01 | **Feature**: [spec.md](../spec.md)

`SessionService` is an Angular root-provided service (`providedIn: 'root'`) that holds the
complete in-memory session state for a single review workflow. State lives in a
`BehaviorSubject<SessionState>` and is never written to `localStorage`, `sessionStorage`, or
any server endpoint. Closing the browser tab clears all state.

**File**: `apps/web/src/app/core/session.service.ts`  
**Types**: `libs/shared/src/entities/session-state.entity.ts`

---

## State Shape

```ts
interface SessionState {
  status: SessionStatus;                         // current workflow phase
  inputDocument: InputDocument | null;           // submitted input
  existingBacklogItems: ExistingBacklogItem[];   // from optional backlog JSON upload
  requirementsSummary: KeyRequirementsSummary | null;
  stories: UserStory[];                          // append-only during streaming
  tasks: Record<string, Task[]>;                 // keyed by UserStory.id
  activeStoryId: string | null;                  // story currently open in review
  auditLog: ReviewAction[];                      // append-only; all reviewer actions
  analysisStartedAt: number | null;              // Date.now() when analysis began
  promptVersions: Record<string, string>;        // { promptName → "M.m.p" }
  analysisError: { code: string; message: string } | null;
  reviewerName: string | null;                   // set at publish time (optional)
}
```

---

## Initial State

```ts
const INITIAL_STATE: SessionState = {
  status: SessionStatus.Idle,
  inputDocument: null,
  existingBacklogItems: [],
  requirementsSummary: null,
  stories: [],
  tasks: {},
  activeStoryId: null,
  auditLog: [],
  analysisStartedAt: null,
  promptVersions: {},
  analysisError: null,
  reviewerName: null,
};
```

---

## Public Observables (Selectors)

All selectors are derived from `state$` using RxJS `pipe(map(...))`. Angular components
subscribe via the `async` pipe; no manual `.subscribe()` calls in components.

| Observable | Type | Description |
|---|---|---|
| `state$` | `Observable<SessionState>` | Full state stream |
| `status$` | `Observable<SessionStatus>` | Current workflow phase |
| `stories$` | `Observable<UserStory[]>` | All stories (any status) |
| `approvedStories$` | `Observable<UserStory[]>` | Stories with status `Approved \| Amended` |
| `pendingStories$` | `Observable<UserStory[]>` | Stories with status `Draft` |
| `rejectedStories$` | `Observable<UserStory[]>` | Stories with status `Rejected` |
| `tasksForStory$(id)` | `Observable<Task[]>` | Tasks for a given story ID |
| `approvedTasksForStory$(id)` | `Observable<Task[]>` | Approved/Amended tasks for a story |
| `canPublish$` | `Observable<boolean>` | `true` when ≥ 1 approved story exists |
| `lowConfidenceItems$` | `Observable<(UserStory \| Task)[]>` | All items with `confidence === Low` |
| `reviewSummary$` | `Observable<{ approved: number; amended: number; rejected: number; pending: number }>` | Story counts for ReviewSummary component |
| `analysisError$` | `Observable<{ code: string; message: string } \| null>` | Current error |

---

## Mutations (Actions)

All mutations call `this.state.next({ ...current, ...patch })` internally. Every story/task
mutation also calls `AuditService.log(ReviewAction)` to append to `auditLog`.

### Analysis lifecycle

```ts
startAnalysis(input: InputDocument, backlogItems: ExistingBacklogItem[]): void
// Resets store to INITIAL_STATE, sets status = Analysing, sets inputDocument + existingBacklogItems

setRequirementsSummary(summary: KeyRequirementsSummary): void
// Sets requirementsSummary

appendStory(story: UserStory): void
// Appends story to stories[]; called per SSE 'story' event

patchStoryOverlap(storyId: string, flag: OverlapFlag, reference: string | null): void
// Updates overlapFlag + overlapReference on a story; called per SSE 'overlap_update' event

setAnalysisComplete(promptVersions: Record<string, string>): void
// Sets status = Review, sets promptVersions, clears analysisStartedAt

setAnalysisError(error: { code: string; message: string }): void
// Sets status = Error, sets analysisError
```

### Story review

```ts
approveStory(id: string): void
// Sets story.status = Approved
// Logs: { actionType: Approve, targetType: 'story', targetId: id, content: null }

rejectStory(id: string, reason?: string): void
// Sets story.status = Rejected
// Logs: { actionType: Reject, targetType: 'story', targetId: id, content: reason ?? null }

amendStory(id: string, patch: Partial<Pick<UserStory, 'title' | 'role' | 'benefit' | 'acceptanceCriteria' | 'priority' | 'category'>>): void
// Saves current story as story.originalAiText (if not already saved)
// Applies patch, sets story.status = Amended
// Logs: { actionType: Amend, targetType: 'story', targetId: id, content: JSON.stringify(patch) }

replaceStory(id: string, newStory: UserStory): void
// Replaces story in stories[] with newStory (status = Draft)
// Logs: { actionType: Regenerate, targetType: 'story', targetId: id, content: null }
```

### Task lifecycle

```ts
setTasksForStory(storyId: string, tasks: Task[]): void
// Stores tasks in tasks[storyId]; called after POST /api/analyse/tasks response

approveTask(storyId: string, taskId: string): void
rejectTask(storyId: string, taskId: string, reason?: string): void
amendTask(storyId: string, taskId: string, patch: Partial<Task>): void
replaceTask(storyId: string, taskId: string, newTask: Task): void
// Mirror of story review mutations; log actionType uses 'task' as targetType
```

### Publish

```ts
setReviewerName(name: string | null): void
// Sets reviewerName

buildExport(): PublishedBacklog
// Pure function — reads current state, returns PublishedBacklog
// Does NOT mutate state; does NOT call setStatus
// Called by PublishComponent before triggering JSON download
// Throws if canPublish$ last value is false

reset(): void
// Resets state to INITIAL_STATE (clears the session)
```

---

## AuditService

**File**: `apps/web/src/app/core/audit.service.ts`

Thin wrapper called by `SessionService` on every mutation. Appends `ReviewAction` entries
to `SessionState.auditLog`. Not called directly by components.

```ts
@Injectable({ providedIn: 'root' })
export class AuditService {
  log(session: SessionService, action: Omit<ReviewAction, 'id' | 'timestamp'>): void;
  // Generates id (UUID), sets timestamp (ISO-8601), appends to auditLog via SessionService
}
```

---

## AnalysisService

**File**: `apps/web/src/app/core/analysis.service.ts`

Manages the `EventSource` connection to `/api/analyse` and `/api/regenerate`. Parses
incoming SSE events and dispatches to `SessionService` mutations.

```ts
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  startAnalysis(formData: FormData): Observable<AnalysisSseEvent>
  // Opens EventSource to POST /api/analyse
  // Returns Observable that emits typed SSE events
  // Completes on 'complete' event; errors on 'error' event

  regenerate(dto: RegenerateDto): Observable<RegenerateSseEvent>
  // Opens EventSource to POST /api/regenerate
  // Returns Observable that emits typed SSE events
}
```

---

## Invariants

These must always hold after any mutation:

1. `auditLog` is append-only — entries are never removed or modified
2. `UserStory.originalAiText` is set at most once (on first Amend) and never overwritten
3. A story with `status = Approved | Amended` cannot be moved back to `Draft` or `Rejected`
   without explicit Reject action (which sets `status = Rejected` regardless of prior state)
4. `tasks[storyId]` is only populated after the reviewer navigates to that story's task view
   (on-demand generation)
5. `buildExport()` must never include a `UserStory` or `Task` with `status = Draft | Rejected`
