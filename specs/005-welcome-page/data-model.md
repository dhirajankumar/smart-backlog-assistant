# Data Model: Welcome Page with MVP1 Onboarding

**Feature**: 005-welcome-page | **Date**: 2026-07-07

## Persistence

None. The welcome page renders unconditionally on every visit. No localStorage keys, cookies, or server-side session are written or read.

---

## Component State (Angular)

### `WelcomeComponent`

| Property | Type | Initial | Description |
|----------|------|---------|-------------|
| `isCopied` | `boolean` | `false` | Drives the "Copied!" visual confirmation. Reset to `false` after 2 seconds via `setTimeout`. |
| `terminalLaunching` | `boolean` | `false` | Disables the "Open Terminal" button while the API request is in-flight. |
| `terminalError` | `string \| null` | `null` | Non-null when the backend returns `success: false`. Drives fallback instruction display. |

No `@Input()` bindings or `@Output()` events — this is a page-level route component with no parent.

---

## API Payload Schemas

### `POST /api/terminal/open`

**Request**: No body required. Platform detection is server-side.

**Response** (TypeScript interface — defined in `apps/api/src/terminal/terminal.service.ts`):

```typescript
interface TerminalOpenResponse {
  success: boolean;
  platform?: 'win32' | 'darwin' | 'linux';
  message?: string; // Error description when success === false
}
```

---

## Static Roadmap Data

Defined as a typed constant in `welcome.component.ts` — not fetched from an API.

```typescript
interface RoadmapPhase {
  id: string;
  label: string;
  description: string;
  available: boolean; // true = current MVP1 feature; false = coming soon
}

const MVP1_ROADMAP: RoadmapPhase[] = [
  {
    id: 'backlog-refinement',
    label: 'AI Backlog Refinement',
    description: 'Automatically refine and decompose requirements into actionable user stories with acceptance criteria.',
    available: true,
  },
  {
    id: 'story-review',
    label: 'Story Review & Approval',
    description: 'Review, amend, and approve AI-generated stories before they enter your backlog.',
    available: true,
  },
  {
    id: 'requirements',
    label: 'Requirements Refinement',
    description: 'Structured elicitation and refinement of raw requirements into validated, prioritised inputs.',
    available: false,
  },
  {
    id: 'feature-spec',
    label: 'Feature Specification',
    description: 'Generate formal feature specs with traceability from requirements to user stories.',
    available: false,
  },
  {
    id: 'planning',
    label: 'Planning',
    description: 'Technical architecture and implementation planning driven by the feature specification.',
    available: false,
  },
  {
    id: 'task-generation',
    label: 'Task Generation',
    description: 'Automatic breakdown of planned work into dependency-ordered, story-linked tasks.',
    available: false,
  },
];
```

---

## Shared Entities — No Changes

The welcome page does not interact with `UserStory`, `Task`, `SessionState`, `PublishedBacklog`, or any existing shared entities in `libs/shared`. No changes to the shared library are required.
