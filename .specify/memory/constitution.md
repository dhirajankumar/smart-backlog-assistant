<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0

  Bump rationale: MINOR — two new principles added (II, V), three existing principles enriched
  and renamed, two new sections added (Audit Trail & Consent; Development Workflow & Quality
  Gates), governance rules fully populated.

  Modified principles (old title → new title):
    - "AI assists, human decide, suggestion are proposal not action" → I. Human Oversight
    - "Data principle" → III. Privacy & Intellectual Property
    - "AI behaviour principle" → IV. AI Safety & Behavior

  Added principles:
    - II. Transparency & Explainability (new)
    - V. Scope Integrity (new)

  Retained (content unchanged, reformatted):
    - "Definition of quality" → Quality Standards section
    - "Guardrail" → Hard Limits section

  Added sections:
    - Audit Trail & Consent
    - Development Workflow & Quality Gates

  Removed sections:
    - Template placeholder blocks [PRINCIPLE_2..5], [SECTION_2..3], [GOVERNANCE_RULES]

  Templates reviewed:
    - .specify/templates/plan-template.md ✅ Constitution Check gate present — no update needed
    - .specify/templates/spec-template.md ✅ Acceptance criteria structure aligns with Quality Standards — no update needed
    - .specify/templates/tasks-template.md ✅ Phase structure aligns with Workflow & Quality Gates — no update needed

  Deferred TODOs:
    - None. All placeholders resolved.
-->

# Smart Backlog Assistant Constitution

## Core Principles

### I. Human Oversight (NON-NEGOTIABLE)

All AI-generated outputs — user stories, task breakdowns, acceptance criteria, priority
suggestions — are proposals only. They MUST NOT be committed to any backlog system without
explicit human review and approval.

- AI MUST surface its confidence level alongside each suggestion; low-confidence outputs MUST be
  flagged visibly to the reviewer before any action is taken.
- No autonomous ticket creation, editing, or deletion. A human action is required for any
  persistent state change in any connected backlog system.
- When the AI cannot determine a safe or unambiguous course of action, it MUST escalate to the
  user rather than defaulting silently.
- AI-assisted work that bypasses human review is a constitution violation and MUST be surfaced
  as CRITICAL during `/speckit-analyze`.

**Rationale**: AI errors in backlog management cascade into wasted engineering effort and missed
business outcomes. The human-in-the-loop requirement is the primary safeguard against hallucinated
or misaligned requirements reaching a team's sprint.

### II. Transparency & Explainability

Every AI suggestion MUST be accompanied by a clear rationale. Users MUST be able to trace each
recommendation back to the input they provided and the principle it applies.

- Suggestions MUST include: what was inferred, why it was inferred, and what was deliberately
  excluded or out-of-scope.
- Black-box outputs (no visible reasoning) are not acceptable. If the AI cannot explain its
  reasoning, the output MUST be withheld and the user notified.
- Explainability applies at every lifecycle stage: specification, planning, task generation, and
  implementation guidance.
- `/speckit-analyze` MUST expose the reasoning chain for every flagged consistency issue so
  reviewers can evaluate and override the finding.

**Rationale**: Without explainability, users cannot evaluate whether AI suggestions are correct,
biased, or hallucinated. Trust in AI-assisted tooling requires full visibility into the reasoning
behind each output.

### III. Privacy & Intellectual Property

Project names, client names, user names, team identifiers, ticket content, and any other
project-specific or personally identifiable information (PII) MUST NOT be used in AI model
training, fine-tuning, or external evaluation pipelines.

- Data is session-scoped by default. No cross-session or cross-team data sharing without
  explicit, documented consent.
- Data minimization: only the minimum data necessary for the current task is surfaced to AI
  evaluation. Surplus context MUST be withheld.
- AI outputs that reference or expose PII from other sessions or teams MUST be suppressed and
  the incident reported.
- Third-party integrations (e.g., GitHub, Linear, Jira) are governed by the same consent
  requirements that apply to AI evaluation.

**Rationale**: Backlog content contains strategic intellectual property and potentially personal
information. Even indirect leakage violates user trust and may breach organizational compliance
obligations.

### IV. AI Safety & Behavior

AI MUST fail safe, not fail silent. All production AI interactions MUST be deterministic,
versioned, and auditable.

- **Model pinning**: Production prompts MUST pin to a specific model version. Unpinned prompts
  are prohibited in production environments.
- **Fail-safe**: A malformed, ambiguous, or low-confidence AI response MUST surface that condition
  visibly to the user rather than substituting a silent default or best-guess fallback.
- **Consistency**: Similar inputs MUST yield consistent outputs. Any non-determinism (e.g., high
  temperature settings) MUST be disclosed and bounded to a known, tested range.
- **Model updates**: Any change in model version requires re-validation of all production prompts
  before promotion. Validation evidence MUST be documented.
- **Prompt versioning**: Prompts are versioned like code (MAJOR.MINOR.PATCH). A breaking prompt
  change MUST bump the MAJOR version and include migration notes for dependent workflows.

**Rationale**: AI model behavior changes between releases. Without version pinning and validation,
a prompt that works today may silently degrade or produce incorrect results after an upstream
model update, with no visible signal to the users relying on it.

### V. Scope Integrity

AI suggestions MUST NOT introduce scope beyond what the original user input explicitly implies
or directly requires.

- Features, tasks, or acceptance criteria not traceable to the original input MUST be labeled
  out-of-scope and presented separately for explicit human approval before inclusion.
- Scope expansions require a documented rationale and MUST NOT be silently merged into
  `spec.md`, `plan.md`, or `tasks.md`.
- During `/speckit-plan` and `/speckit-tasks`, each generated artifact MUST map to at least one
  requirement in `spec.md`. Items without a traceable source are flagged ORPHAN and blocked
  from implementation until resolved.
- `/speckit-clarify` MUST be invoked before planning whenever requirements contain implicit
  scope assumptions.

**Rationale**: Scope creep driven by AI inference is harder to detect and challenge than scope
creep from human decisions, because AI confidence can mask the expansion. Explicit traceability
prevents invisible bloat from entering the backlog.

## Quality Standards

### What "quality" means in this project

A quality AI suggestion is one that:

1. A senior engineer or PM would not need to rewrite substantially.
2. Includes acceptance criteria that are testable, not aspirational.
3. Identifies at least one edge case the original author missed.
4. Does not introduce scope the original input did not imply (see Principle V).
5. Is explainable — the user can see why the AI made each suggestion (see Principle II).

### A quality user story and/or task (post-refinement) MUST:

1. Have a clear, single user-facing outcome.
2. Have at least 2–3 acceptance criteria, each independently testable.
3. Include a suggested priority or categorization that is business-oriented, not technically
   driven.
4. Include a summary of the key requirements identified from the original input.
5. Contain no ambiguous terms without an accompanying definition or clarification.
6. Be self-contained enough for a new team member to pick up with no prior context.

## Hard Limits

The following behaviors are prohibited without exception and cannot be overridden by user
instruction or configuration:

- This tool will NEVER autonomously edit, create, or delete tickets in any backlog system.
- This tool will NEVER store ticket content beyond the session audit log without explicit user
  and organizational consent.
- This tool will NEVER use one team's ticket data to train or influence suggestions for another
  team without explicit cross-team consent.
- This tool will NEVER surface PII or confidential project details from a prior session into a
  subsequent session.
- Claude Code will NEVER modify this constitution file autonomously. All amendments require
  human authorship and MUST follow the governance procedure below.

## Audit Trail & Consent

- Every AI-assisted backlog interaction MUST be traceable in a session audit log (session ID,
  timestamp, input summary, AI output, human approval status).
- Cross-team or cross-project data sharing requires explicit, documented consent captured
  per-session before any data is shared.
- Audit logs MUST be retained per the organization's data retention policy. In the absence of
  an explicit policy, the default retention period is 90 days.
- Users MUST be notified when an AI output is based on inference rather than explicit input.
  Inferred content MUST be visually distinguished from stated requirements in all generated
  artifacts.

## Development Workflow & Quality Gates

- Every feature MUST pass `/speckit-analyze` before tasks are handed to implementation.
  Findings classified CRITICAL block progress until resolved.
- Constitution compliance is verified during `/speckit-plan` via the Constitution Check gate.
  Any non-compliance MUST be documented under Complexity Tracking in `plan.md` with an explicit
  justification; undocumented violations block the plan from being accepted.
- User stories MUST be independently testable before being promoted from Draft to Ready status.
- Specification, planning, and task artifacts MUST remain in sync. Divergence detected by
  `/speckit-converge` MUST be resolved before new story work is started.
- `/speckit-clarify` MUST be run when any requirement contains an ambiguous term — defined as
  any term without an accepted definition traceable to the spec or a recognized domain glossary.

## Governance

This constitution supersedes all other project guidelines. In the event of conflict, this
document governs.

**Amendment Procedure:**

1. Propose the amendment in writing, identifying the principle(s) or section(s) affected and
   the rationale for the change.
2. Classify the version impact: MAJOR, MINOR, or PATCH (see Versioning Policy below).
3. At least one reviewer other than the proposer MUST approve the amendment before ratification.
4. Upon ratification: update this file, propagate changes to dependent templates
   (`plan-template.md`, `spec-template.md`, `tasks-template.md`), and update `LAST_AMENDED_DATE`.
5. Commit with message: `docs: amend constitution to vX.Y.Z (<one-line summary>)`.

**Versioning Policy (Semantic):**

- **MAJOR**: Removal or redefinition of a core principle; backward-incompatible governance change.
- **MINOR**: New principle or section added; material expansion of existing guidance.
- **PATCH**: Clarifications, wording fixes, typo corrections, non-semantic refinements.

**Compliance Review Schedule:**

- Constitution compliance is verified automatically during every `/speckit-analyze` and
  `/speckit-plan` run.
- A full constitution review MUST occur: (a) quarterly, (b) after any AI model version change
  in production, or (c) following a reported constitution violation or incident.
- CRITICAL violations block feature progress. Non-CRITICAL violations are logged and addressed
  in the next amendment cycle.

**Audit of Constitution Changes:**

- All changes are tracked via git history. Amendment commits MUST reference the version change
  in the commit message subject.
- `LAST_AMENDED_DATE` MUST be updated in the version footer on every MINOR or MAJOR change.

---

**Version**: 1.1.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
