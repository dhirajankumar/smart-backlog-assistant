# Smart backlog assistance Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### AI assists, human decide, suggestion are proposal not action.
<!-- Example: I. Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

## Data principle
- don't use project name, user name or client name and other PII (if any) in AI evaluation, consider those as Intellactual properties


## AI behaviour principle
- Always proivide suggestion to choose before selecting any tools to implement. 
- Prompts are versioned like code. A prompt that works today may break 
  after a model update. Pin model versions in production.
- Fail safe, not fail silent. If the AI returns a malformed or 
  low-confidence response, surface that to the user rather than 
  substituting a default.

## Definition of quality (project-specific)  
### What "quality" means in this project
A quality AI suggestion is one that:
1. A senior engineer or PM would not need to rewrite substantially
2. Includes acceptance criteria that are testable, not aspirational
3. Identifies at least one edge case the original author missed
4. Does not introduce scope the original ticket did not imply
5. Is explainable — the user can see why the AI made each suggestion

### Output: A quality user story and/or task (post-refinement) is one that:
1. Has a clear, single user-facing outcome
2. Has at least 2-3 acceptance criteria, each independently testable
3. Must have a suggested priority or categorization should be business oriented
4. Must have Summary of key requirements identified
3. Has no ambiguous terms without a definition
4. Could be picked up by a new team member with no prior context

## Guardrail 
### What this tool will never do.
- This tool will never autonomously edit, create, or delete tickets.
- This tool will never store ticket content beyond the session 
  audit log without explicit user and org consent.
- This tool will never use one team's ticket data to influence 
  suggestions for another team without explicit cross-team consent.
- Claude Code will never modify this file autonomously.



### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_3_NAME]
<!-- Example: III. Test-First (NON-NEGOTIABLE) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### [PRINCIPLE_4_NAME]
<!-- Example: IV. Integration Testing -->
[PRINCIPLE_4_DESCRIPTION]
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### [PRINCIPLE_5_NAME]
<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->
[PRINCIPLE_5_DESCRIPTION]
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->


**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->



