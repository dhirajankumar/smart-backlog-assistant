# Data Model: AI-Backed Backlog Refinement — MVP1

**Date**: 2026-07-01 | **Feature**: [spec.md](./spec.md)

All entities are defined as TypeScript interfaces in `libs/shared/src/entities/`. Enums are
in `libs/shared/src/enums/`. These are the single source of truth shared between NestJS
(backend) and Angular (frontend).

---

## Enums

```ts
// libs/shared/src/enums/priority.enum.ts
export enum Priority { High = 'High', Medium = 'Medium', Low = 'Low' }

// libs/shared/src/enums/confidence.enum.ts
export enum Confidence { High = 'High', Medium = 'Medium', Low = 'Low' }

// libs/shared/src/enums/status.enum.ts
export enum ItemStatus {
  Draft    = 'Draft',
  Approved = 'Approved',
  Amended  = 'Amended',
  Rejected = 'Rejected',
}

// libs/shared/src/enums/overlap-flag.enum.ts
export enum OverlapFlag {
  None             = 'none',
  SessionDuplicate = 'session_duplicate',
  ExistingOverlap  = 'existing_overlap',
}

// libs/shared/src/enums/action-type.enum.ts
export enum ActionType {
  Approve    = 'Approve',
  Reject     = 'Reject',
  Amend      = 'Amend',
  Feedback   = 'Feedback',
  Regenerate = 'Regenerate',
}

// libs/shared/src/enums/session-status.enum.ts
export enum SessionStatus {
  Idle        = 'idle',
  Submitting  = 'submitting',
  Analysing   = 'analysing',
  Review      = 'review',
  TaskReview  = 'task_review',
  Published   = 'published',
  Error       = 'error',
}

// libs/shared/src/enums/input-format.enum.ts
export enum InputFormat { Text = 'text', PDF = 'pdf' }
```

---

## Entities

### InputDocument

Represents the primary input submitted by the reviewer.

```ts
// libs/shared/src/entities/input-document.entity.ts
export interface InputDocument {
  id: string;                  // UUID, generated at submission
  format: InputFormat;         // 'text' | 'pdf'
  rawContent: string;          // extracted plain text (post-PDF parsing)
  filename: string | null;     // original filename if uploaded; null for pasted text
  wordCount: number;
  segmentCount: number;        // 1 for inputs ≤ 5,000 words; N for segmented inputs
  submittedAt: string;         // ISO-8601 timestamp
}
```

---

### ExistingBacklogItem

Read-only item loaded from the optional existing backlog JSON. Never persisted or modified.

```ts
// libs/shared/src/entities/existing-backlog-item.entity.ts
export interface ExistingBacklogItem {
  title: string;               // required (FR-021)
  description?: string;
  priority?: string;
  category?: string;
}
```

**Schema constraint** (FR-021): Accepts an array of objects each with at minimum a `title`
field. Files not matching this schema are rejected with `BACKLOG_SCHEMA_INVALID`.

---

### KeyRequirementsSummary

AI-generated bulleted list of requirements identified from the primary input. Displayed before
individual stories. Included in the export and audit log.

```ts
// libs/shared/src/entities/key-requirements-summary.entity.ts
export interface KeyRequirementsSummary {
  bullets: string[];           // AI-extracted requirement statements
  reviewerNote: string | null; // optional reviewer correction added before story review
  generatedAt: string;         // ISO-8601
  promptVersion: string;       // e.g., "1.0.0"
}
```

---

### UserStory

AI-generated or reviewer-amended user story. Core entity of the review workflow.

```ts
// libs/shared/src/entities/user-story.entity.ts
export interface UserStory {
  id: string;                          // UUID
  title: string;
  role: string;                        // "As a <role>"
  benefit: string;                     // "I want to <action> so that <benefit>"
  acceptanceCriteria: string[];        // minimum 2 (FR-003)
  priority: Priority;
  category: string;                    // from fixed set in constants/categories.ts
  confidence: Confidence;
  rationale: string;                   // AI explanation of what was inferred (FR-005)
  overlapFlag: OverlapFlag;
  overlapReference: string | null;     // title of matching existing/session item
  status: ItemStatus;
  originalAiText: Omit<UserStory, 'status' | 'originalAiText'> | null; // preserved on Amend
  sourceSegment: number;               // which input segment produced this story
  promptVersion: string;
  generatedAt: string;                 // ISO-8601
}
```

**State transitions**:
```
Draft → Approved   (reviewer clicks Approve)
Draft → Amended    (reviewer edits any field and saves)
Draft → Rejected   (reviewer clicks Reject)
Draft → Draft      (reviewer submits Feedback → AI Regenerates → new Draft replaces old)
```

---

### Task

Concrete work item linked to a parent UserStory. Carries the same structured fields as
UserStory minus `role`, `benefit`, and `acceptanceCriteria`.

```ts
// libs/shared/src/entities/task.entity.ts
export interface Task {
  id: string;                          // UUID
  storyId: string;                     // parent UserStory.id
  title: string;
  description: string;
  priority: Priority;
  category: string;
  confidence: Confidence;
  rationale: string;
  overlapFlag: OverlapFlag;
  overlapReference: string | null;
  status: ItemStatus;
  originalAiText: Omit<Task, 'status' | 'originalAiText'> | null;
  promptVersion: string;
  generatedAt: string;
}
```

**Generation trigger**: On-demand — generated when the reviewer navigates into a story's task
view. Tasks are generated per approved story in isolation (FR-012).

---

### ReviewAction

Records a single reviewer decision. Append-only — never modified after creation.

```ts
// libs/shared/src/entities/review-action.entity.ts
export interface ReviewAction {
  id: string;                          // UUID
  actionType: ActionType;
  targetType: 'story' | 'task';
  targetId: string;                    // UserStory.id or Task.id
  content: string | null;              // rejection reason, amended fields JSON, or feedback text
  timestamp: string;                   // ISO-8601
}
```

---

### PublishedBacklog

The finalized export artifact. Built by `export.service.ts` from `SessionService` state.
Contains ONLY approved and amended items (FR-013). Rejected items are absent from
`userStories` but their `ReviewAction` records remain in `auditLog` (FR-015, FR-017).

```ts
// libs/shared/src/entities/published-backlog.entity.ts
export interface PublishedBacklog {
  exportVersion: string;               // e.g., "1.0.0"
  exportId: string;                    // UUID
  exportTimestamp: string;             // ISO-8601
  model: string;                       // MODEL_ID constant value
  promptVersions: Record<string, string>; // { promptName → version }
  inputSummary: {
    format: InputFormat;
    filename: string | null;
    wordCount: number;
    submittedAt: string;
  };
  existingBacklogItemCount: number;
  reviewerName: string | null;         // optional, entered at publish time
  keyRequirementsSummary: KeyRequirementsSummary;
  userStories: (UserStory & { tasks: Task[] })[]; // status: Approved | Amended only
  auditLog: ReviewAction[];            // all actions including rejected items' actions
}
```

---

### SessionState

Shape of the `BehaviorSubject` held by `SessionService` in the Angular frontend.
In-memory only — not persisted to any storage.

```ts
// libs/shared/src/entities/session-state.entity.ts
export interface SessionState {
  status: SessionStatus;
  inputDocument: InputDocument | null;
  existingBacklogItems: ExistingBacklogItem[];
  requirementsSummary: KeyRequirementsSummary | null;
  stories: UserStory[];
  tasks: Record<string, Task[]>;       // keyed by UserStory.id
  activeStoryId: string | null;
  auditLog: ReviewAction[];
  analysisStartedAt: number | null;    // Date.now() ms timestamp
  promptVersions: Record<string, string>;
  analysisError: { code: string; message: string } | null;
  reviewerName: string | null;
}
```

---

## Entity Relationships

```
InputDocument ──────────────────────────────── 1 session
     │
     ├── produces ──────────────────────────── KeyRequirementsSummary (1)
     │
     └── produces ──────────────────────────── UserStory[] (0..N)
                                                    │
                    ExistingBacklogItem[] ──────── overlap detection
                    (read-only context)              │
                                               UserStory
                                                    │
                                                    ├── has ─────── ReviewAction[] (0..N)
                                                    └── has ─────── Task[] (0..N)
                                                                        │
                                                                        └── has ── ReviewAction[] (0..N)

PublishedBacklog
  ├── contains ── KeyRequirementsSummary
  ├── contains ── UserStory[] (Approved | Amended only) + nested Task[]
  └── contains ── ReviewAction[] (all, including rejected items' actions)
```

---

## Constants

```ts
// libs/shared/src/constants/model.ts
export const MODEL_ID = 'claude-sonnet-4-6' as const;

// libs/shared/src/constants/categories.ts
export const CATEGORIES = [
  'Core Workflow',
  'Data Management',
  'Compliance',
  'Reporting',
  'User Experience',
  'Integration',
] as const;
export type Category = typeof CATEGORIES[number];

// libs/shared/src/constants/limits.ts
export const LIMITS = {
  MAX_PDF_SIZE_BYTES: 10 * 1024 * 1024,   // 10 MB
  MAX_WORD_COUNT: 5_000,
  ANALYSIS_TIMEOUT_MS: 60_000,
  ABORT_SIGNAL_MS: 58_000,
  IMAGE_PDF_TEXT_THRESHOLD: 50,            // chars; below this → PDF_IMAGE_ONLY
  OVERLAP_IOU_THRESHOLD: 0.6,
  AI_TEMPERATURE: 0.3,
} as const;
```
