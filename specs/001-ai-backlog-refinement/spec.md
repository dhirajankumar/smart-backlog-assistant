# Feature Specification: AI-Backed Backlog Refinement — MVP1

**Feature Branch**: `001-ai-backlog-refinement`

**Created**: 2026-07-01

**Last Updated**: 2026-07-01

**Status**: Draft

**Input**: User description (original): "I want to build a AI backed backlog refinement tool, that
can analyse tickets, meeting notes or requirement document. It should able to create user stories
and tasks with human-in-loop approach, for that reviewer can approve, reject, amend or give
feedback before publishing user stories or task. First want to build simple MVP1 for end to end
working system."

**Refinement**: Input supports text, PDF, and optional existing backlog JSON. Each output user
story and task must include: well-formatted description, basic acceptance criteria, suggested
priority or categorization, and a summary of key requirements identified from the input.

## Clarifications

### Session 2026-07-01

- Q: Should MVP1 include the ability to load existing backlog items so the AI can use them as context when generating new stories (e.g., to avoid duplicates and stay consistent with existing work)? → A: Yes — Option A: accept an optional JSON file of existing backlog items; AI uses it for context and duplicate detection only; no writes to the source system.
- Q: What is the maximum acceptable wait time between submitting input and seeing AI-generated stories on screen? → A: Option B — up to 60 seconds, with a visible step-by-step progress indicator (e.g., "Extracting text… Analysing requirements… Generating stories…").
- Q: How long should an in-progress review session be preserved if the reviewer leaves without publishing? → A: Option A — browser session only; state is preserved while the tab is open; closing the browser loses the session; server-side persistence is post-MVP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Submit Input for AI Analysis (Priority: P1)

A product analyst or PM pastes text or uploads a PDF — a support ticket, a set of meeting notes,
or a requirements document — and optionally uploads a JSON file of existing backlog items to give
the AI context. The system shows a Key Requirements Summary before individual stories are
displayed. Each story comes with a clear description, basic acceptance criteria, a suggested
priority and category, a confidence score, and a rationale. Stories that closely match existing
backlog items are flagged with an "Existing overlap" indicator showing the matching item title.

**Why this priority**: This is the entry point of the entire system. Without it, nothing else
works. It is the highest-value step and unblocks all downstream review and publishing.

**Independent Test**: A tester uploads a two-page PDF requirements document and an optional JSON
file of 10 existing backlog items, then clicks Analyse. The system returns: (1) a Key Requirements
Summary, and (2) at least two draft user stories — each with a formatted description, at least two
acceptance criteria, a suggested priority, a category, a confidence indicator, and a rationale.
Any story matching an existing item is flagged "Existing overlap". No additional configuration is
required.

**Acceptance Scenarios**:

1. **Given** a reviewer uploads a PDF and clicks Analyse, **Then** the system extracts text,
   displays a Key Requirements Summary, and returns at least one draft user story with a formatted
   title, role and benefit, at least two acceptance criteria, a suggested priority
   (High / Medium / Low), a category label, a confidence indicator, and a rationale paragraph.
2. **Given** a reviewer pastes plain text and submits, **Then** the system produces the same
   structured output format as PDF submission.
3. **Given** the reviewer also uploads an existing backlog JSON alongside the primary input,
   **When** analysis completes, **Then** any AI-generated story that closely matches an existing
   item is flagged with an "Existing overlap — possible duplicate" indicator that shows the title
   of the matching existing item.
4. **Given** the submitted input contains no actionable requirements, **When** analysis completes,
   **Then** the system displays a clear "no stories extracted" message rather than generating
   low-quality guesses.
5. **Given** a reviewer submits input for analysis, **When** processing is underway, **Then** a
   visible step-by-step progress indicator is displayed (e.g., "Extracting text… Analysing
   requirements… Generating stories…") and results appear within 60 seconds for inputs up to
   5,000 words.
6. **Given** the AI returns a low-confidence result for any story, **When** it is displayed,
   **Then** the confidence level is visually highlighted and the reviewer is prompted to inspect it
   before accepting.
7. **Given** the reviewer views the Key Requirements Summary, **When** they identify a requirement
   was missed or misunderstood, **Then** they can add a correction note before reviewing individual
   stories.

---

### User Story 2 — Review and Refine AI-Generated User Stories (Priority: P1)

A reviewer works through the list of AI-generated draft user stories one by one. Each story is
presented in a well-formatted layout showing the role, benefit, acceptance criteria, suggested
priority, category, and any "Existing overlap" flag. The reviewer can approve as-is, reject with a
reason, amend any field directly, or provide free-text feedback to trigger AI regeneration. No
story moves to the publish stage without explicit human action.

**Why this priority**: This is the human-in-the-loop gate that makes the tool trustworthy. It is
co-P1 with story submission because together they form the minimum viable end-to-end loop.

**Independent Test**: Given three AI-generated draft stories (one flagged "Existing overlap"), a
tester approves one as-is, amends the acceptance criteria and priority of the second, and rejects
the third. After each action the story status updates visibly. The amended story retains all
edits. The rejected story is removed from the publish queue.

**Acceptance Scenarios**:

1. **Given** a draft user story is displayed, **When** the reviewer clicks Approve, **Then** the
   story status changes to Approved and it is added to the publish queue with its priority and
   category intact.
2. **Given** a draft user story is displayed, **When** the reviewer edits any field (title,
   description, acceptance criteria, priority, or category) and saves, **Then** the amended version
   is shown marked Amended — Approved, and the original AI-generated text is preserved for audit.
3. **Given** a draft user story is displayed, **When** the reviewer clicks Reject and optionally
   enters a reason, **Then** the story is removed from the publish queue and the rejection reason
   is logged.
4. **Given** a draft user story is displayed, **When** the reviewer enters free-text feedback and
   clicks Regenerate, **Then** the AI produces a revised version incorporating the feedback,
   retaining the structured output format, and the reviewer can act on it independently.
5. **Given** a reviewer has acted on all stories, **When** they view the summary, **Then** they
   can see the count of approved, amended, and rejected stories before proceeding to publish.

---

### User Story 3 — Review and Refine AI-Generated Tasks (Priority: P2)

For each approved user story, the AI generates draft tasks with the same structured format:
description, suggested priority, category, and rationale. The reviewer applies the same
approve / reject / amend / feedback workflow to tasks. Only reviewer-approved tasks are included
in the published backlog.

**Why this priority**: Tasks depend on approved stories. P2 because the system delivers value at
P1 even without task review; task review makes the output team-ready.

**Independent Test**: Given one approved user story, a tester views the AI-generated tasks —
each showing description, priority, and category — approves two, rejects one, and amends one.
After publishing, only the two approved and the amended task appear in the output.

**Acceptance Scenarios**:

1. **Given** a user story is approved, **When** the reviewer navigates to its tasks, **Then** the
   system displays AI-generated tasks linked to that story, each with a formatted description,
   suggested priority, category, and rationale.
2. **Given** a draft task is displayed, **When** the reviewer approves, rejects, amends, or
   requests regeneration, **Then** the same behaviour applies as for user stories (see US2 above).
3. **Given** all tasks for a story have been reviewed, **When** the reviewer marks the story as
   task-complete, **Then** only approved and amended tasks are included in the publish queue.

---

### User Story 4 — Publish Approved Backlog Items (Priority: P2)

Once all stories and tasks have been reviewed, the reviewer publishes the finalized set. For MVP1,
publishing exports the approved backlog as a structured document that includes the Key Requirements
Summary, all approved user stories (with descriptions, acceptance criteria, priority, category, and
any overlap flags), and their linked tasks. The session audit log is retained.

**Why this priority**: Publishing completes the end-to-end loop. It is P2 because review must
exist first; without it there is nothing to publish.

**Independent Test**: A tester reviews stories and tasks, then clicks Publish. An export is
generated containing the Key Requirements Summary, all approved stories with their full structured
content (including any overlap flags), and their approved tasks. Rejected items are absent.

**Acceptance Scenarios**:

1. **Given** at least one approved user story is in the queue, **When** the reviewer clicks
   Publish, **Then** the system generates a structured, human-readable export containing: the Key
   Requirements Summary, all approved stories with their full structured format (including any
   overlap flags), and their approved tasks.
2. **Given** the reviewer clicks Publish, **Then** the export includes ONLY items that received
   explicit reviewer approval — no draft or rejected items appear.
3. **Given** the session is published, **Then** the system retains a session audit log capturing:
   the original input (type and content), the existing backlog JSON reference (if provided), the
   Key Requirements Summary, all AI drafts, every reviewer action with timestamps, and the final
   published set.
4. **Given** the reviewer has zero approved stories, **When** they attempt to publish, **Then** the
   system prevents publishing and displays a message requiring at least one approved story.

---

### Edge Cases

- What happens when the input contains no actionable requirements? → System displays a "no stories
  extracted" message; reviewer can re-submit.
- What happens when a PDF is scanned or image-based with no extractable text? → System displays an
  error and prompts the reviewer to provide text-based input instead.
- What happens when the existing backlog JSON file has an unrecognized or invalid structure? →
  System rejects the file with a clear error explaining the expected flat schema (array of objects
  with at minimum a `title` field) and allows the reviewer to proceed with analysis without it.
- What happens when the existing backlog JSON is provided but is empty (zero items)? → System
  proceeds normally; no overlap checks are run and no warning is shown.
- What happens when the AI generates near-duplicate user stories from overlapping input sections?
  → Duplicates within the session are flagged with a "possible duplicate" indicator.
- What happens when reviewer feedback contradicts the original input? → The AI regenerates based
  on the feedback; the rationale notes the conflict and the reviewer decides.
- What happens when the reviewer closes the browser or tab before publishing? → Session state is
  browser-only; closing the tab or browser permanently loses all in-progress review state.
  Nothing is auto-published. The reviewer must start a new session.
- What happens if the input is too long? → The system splits into segments, processes each, and
  tags stories with their source segment.
- What happens if the PDF exceeds the supported size limit? → System displays a clear error with
  the size limit and instructions to split or compress.
- What happens if AI analysis exceeds 60 seconds? → The system displays a timeout message and
  offers the reviewer the option to retry or reduce the input size.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept primary input in two formats: (a) pasted free-text and (b)
  uploaded PDF file, representing tickets, meeting notes, or requirements documents. Additionally,
  the system MUST accept an optional (c) JSON file of existing backlog items uploaded alongside
  the primary input.
- **FR-002**: System MUST analyse the submitted primary input and generate a Key Requirements
  Summary — a concise, bulleted list of the requirements the AI identified — displayed at the top
  of the review session before individual stories are presented.
- **FR-003**: System MUST generate one or more draft user stories from the primary input. Each
  user story MUST be well-formatted and contain: a clear title, a role (who benefits), a benefit
  statement (why it matters), and at least two independently testable acceptance criteria.
- **FR-004**: Each AI-generated user story and task MUST include a suggested priority level
  (High / Medium / Low) and a business category label (e.g., Core Workflow, Data Management,
  Compliance, Reporting).
- **FR-005**: Each AI-generated user story and task MUST include a visible confidence indicator
  (High / Medium / Low) and a rationale paragraph explaining what was inferred from the input.
- **FR-006**: System MUST flag low-confidence outputs visually and prompt the reviewer to inspect
  them before approving.
- **FR-007**: System MUST present AI-generated user stories in a reviewable list where the
  reviewer can act on each story individually.
- **FR-008**: Reviewer MUST be able to approve a user story as-is, including its suggested
  priority and category.
- **FR-009**: Reviewer MUST be able to reject a user story with an optional written reason.
- **FR-010**: Reviewer MUST be able to directly amend any field of a user story — including title,
  description, acceptance criteria, priority, or category — before approving it.
- **FR-011**: Reviewer MUST be able to provide free-text feedback on a user story and trigger AI
  regeneration. The regenerated story MUST retain the structured output format.
- **FR-012**: System MUST generate draft tasks for each user story in the same structured format
  as user stories (description, priority, category, rationale) and present them through the same
  approve / reject / amend / feedback workflow.
- **FR-013**: System MUST NOT include any user story or task in the published output unless it has
  received explicit reviewer approval.
- **FR-014**: System MUST generate a structured export containing: the Key Requirements Summary,
  all approved user stories with their full structured content (including any overlap flags), and
  their approved tasks.
- **FR-015**: System MUST maintain a session audit log capturing: original input (type and
  content), existing backlog JSON reference if provided, the Key Requirements Summary, all AI
  drafts, every reviewer action with timestamp, and the final published set.
- **FR-016**: System MUST detect and flag near-duplicate AI-generated user stories within the same
  session, presenting them with a "possible duplicate" indicator.
- **FR-017**: System MUST preserve all reviewer amendments in the audit log alongside the original
  AI-generated text.
- **FR-018**: System MUST display a clear error message when a PDF cannot be read (e.g., scanned
  image, unsupported encoding, or file too large) and guide the reviewer to an alternative.
- **FR-019**: When an existing backlog JSON file is provided, the system MUST use the existing
  items for read-only context only — their titles, descriptions, and categories inform AI
  generation and duplicate detection. No data is written to or transmitted back to the source.
- **FR-020**: When existing backlog items are loaded, the AI MUST cross-reference AI-generated
  user stories and tasks against existing items and flag any that closely overlap with an
  "Existing overlap — possible duplicate" indicator showing the matching existing item's title.
- **FR-021**: The system MUST accept existing backlog JSON files conforming to a simple flat
  schema: an array of objects each containing at minimum a `title` field, and optionally
  `description`, `priority`, and `category` fields. Files not matching this schema MUST be
  rejected with a clear error explaining the expected format.
- **FR-022**: System MUST display a visible step-by-step progress indicator during AI analysis
  (e.g., "Extracting text → Analysing requirements → Generating stories") from submission until
  results appear. Analysis MUST complete and display results within 60 seconds for inputs up to
  5,000 words. If the 60-second limit is exceeded, the system MUST display a timeout message and
  offer the reviewer the option to retry or reduce the input size.

### Key Entities

- **InputDocument**: The submitted primary input; attributes include raw content, format
  (text / PDF), file name (if uploaded), submission timestamp, and session reference.
- **ExistingBacklogItem**: A read-only item loaded from the optional backlog JSON; attributes
  include title, description (optional), priority (optional), category (optional). Used solely
  as context for AI generation and overlap detection — never persisted or modified.
- **KeyRequirementsSummary**: The AI-generated list of requirements identified from the primary
  input; displayed before individual stories; included in the export and audit log.
- **UserStory**: AI-generated or reviewer-amended story; attributes include title, role, benefit,
  acceptance criteria list, suggested priority (High/Medium/Low), category label, confidence
  level, AI rationale, overlap flag (none / session-duplicate / existing-overlap with reference),
  status (Draft / Approved / Amended / Rejected), and source segment reference.
- **Task**: A concrete work item linked to a parent UserStory; carries the same priority,
  category, confidence, rationale, overlap flag, and status fields as UserStory.
- **ReviewAction**: Records a single reviewer decision; attributes include action type
  (Approve / Reject / Amend / Feedback / Regenerate), content (reason or amended text),
  timestamp, and reference to the affected UserStory or Task.
- **PublishedBacklog**: The finalized export artifact; contains the KeyRequirementsSummary,
  approved UserStories and Tasks (with overlap flags where applicable), publish timestamp,
  reviewer identity reference, and session audit log reference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can complete the full workflow — submit input, review the Key Requirements
  Summary, review stories and tasks, and publish — in under 10 minutes for a standard input of
  500–1,000 words.
- **SC-002**: At least 70% of AI-generated user stories require no amendment before approval in
  user acceptance testing, demonstrating adequate generation quality for an MVP.
- **SC-003**: Every published user story contains a well-formatted title, role, benefit statement,
  and at least two independently testable acceptance criteria — verifiable by inspecting the export.
- **SC-004**: Every published user story and task carries an explicit priority level and category
  label — verifiable by inspecting the export artifact.
- **SC-005**: Zero user stories or tasks are included in any published export without an explicit
  reviewer approval action — verified across all test sessions.
- **SC-006**: A first-time reviewer can complete the full review workflow without written
  instructions in under 5 minutes, measured during usability testing.
- **SC-007**: The session audit log for every session captures 100% of reviewer actions and AI
  outputs — verified by replaying the log against the final published set.
- **SC-008**: PDF uploads of up to the supported size limit are successfully processed and produce
  equivalent output quality to equivalent text input — measured across a test set of 10 documents.
- **SC-009**: When an existing backlog JSON is provided and a generated story closely matches an
  existing item, 100% of such overlaps are flagged with an "Existing overlap" indicator —
  verified using a test set with known matching items.
- **SC-010**: AI analysis completes and results appear on screen within 60 seconds for inputs up
  to 5,000 words — verified by timing 10 test submissions across varying input sizes and formats.

## Assumptions

- MVP1 targets a single reviewer per session — multi-stakeholder review workflows are post-MVP.
- Input is expected in English; multi-language processing is out of scope for MVP1.
- PDF support covers text-based PDFs only; scanned or image-only PDFs surface a clear error.
- The existing backlog JSON must conform to the flat schema defined in FR-021. Non-conforming
  files are rejected. Parsing complex/nested schemas (e.g., full Jira export format) is post-MVP.
- For MVP1, publishing means generating a structured export file (formatted text or JSON); direct
  integration with Jira, Linear, Azure DevOps, or other backlog systems is post-MVP.
- The reviewer is assumed to have product or business domain knowledge to evaluate AI suggestions.
- User authentication and access management are pre-existing or deferred to post-MVP; MVP1 assumes
  a single authenticated user context.
- Mobile interface is out of scope for MVP1; the tool targets a web or desktop interface.
- AI model selection and prompt configuration are handled at the infrastructure level; the reviewer
  UI does not expose model settings in MVP1.
- Input documents of up to 5,000 words (or equivalent PDF text) are supported in MVP1; larger
  documents are split into segments automatically.
- The category labels (e.g., Core Workflow, Data Management, Compliance) are drawn from a fixed
  set defined at the infrastructure level; reviewers can override them via amendment but cannot
  add new categories in MVP1.
- The existing backlog JSON is treated as read-only context — the system makes no API calls or
  writes to any external system based on this file.
- Session state is maintained in the browser only and is not persisted server-side. Closing the
  browser tab ends the session and any unfinished review is lost. Server-side session persistence
  is post-MVP.
