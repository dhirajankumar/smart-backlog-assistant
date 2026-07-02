# ADR-003: AI Model Pinning and Prompt Versioning Policy

## Status

Accepted — 2026-07-01

## Context

The project constitution (Principle IV: AI Safety & Behavior) mandates that:
- Production prompts MUST pin to a specific model version
- Any change in model version requires re-validation of all production prompts before promotion
- Prompts are versioned like code (MAJOR.MINOR.PATCH)
- A breaking prompt change MUST bump the MAJOR version and include migration notes

The Anthropic TypeScript SDK (`@anthropic-ai/sdk`) accepts a `model` string parameter in
every API call. Without enforcement, different callers could inadvertently use different model
versions, or a developer could change the model string in one place without updating others.

Additionally, AI-generated outputs (user stories, tasks, key requirements summaries) must
carry a record of which prompt version and model produced them — both for the session audit
log (FR-015) and the published export (FR-014).

## Decision

**Model pinning**: Define a single constant `MODEL_ID = 'claude-sonnet-4-6' as const` in
`libs/shared/src/constants/model.ts`. This is the only location in the codebase where the
model identifier appears. All `ai.service.ts` calls import this constant. A TypeScript lint
rule (`no-hardcoded-strings` on the model parameter) prevents inline model strings.

**Prompt versioning**: Each prompt file in `apps/api/src/ai/prompts/` exports:
```ts
export const myPrompt = {
  version: '1.0.0',               // MAJOR.MINOR.PATCH per constitution policy
  build: (ctx: PromptContext) => string,
};
```

`prompt.registry.ts` collects all prompt names and versions into a
`Record<string, string>` map at startup. This map is:
- Attached to every `UserStory`, `Task`, and `KeyRequirementsSummary` as `promptVersion`
- Included in `PublishedBacklog.promptVersions`
- Logged in `ReviewAction` records where a regeneration occurred

**Version change procedure**:
1. PATCH: wording fix, no schema change → increment PATCH, no re-validation required
2. MINOR: new optional output field or improved instructions → increment MINOR, run evaluation
   cases in `docs/prompts/evaluation-cases.md` before merging
3. MAJOR: structural output schema change → increment MAJOR, run full evaluation suite,
   update `docs/prompts/` canonical versions, update dependent DTO schemas, add migration
   notes in the commit message

**Model update procedure**: If `MODEL_ID` is changed, a mandatory re-validation gate runs
all evaluation cases in `docs/prompts/evaluation-cases.md` before the change is merged to
`main`. Evidence of passing evaluation is documented in the ADR amendment.

## Consequences

**Positive**:
- Single point of model configuration — changing the model is a one-line change with full
  visibility in git diff
- Prompt versions in every exported artifact enable forensic tracing of which prompt produced
  a given output (constitution Principle II: Transparency)
- Breaking prompt changes are surfaced clearly via MAJOR version bump before they reach
  production
- Evaluation cases (`docs/prompts/evaluation-cases.md`) provide a regression baseline

**Negative / trade-offs**:
- Model pinning means the application does not automatically benefit from model improvements;
  each model upgrade requires an explicit decision and validation pass
- Prompt versioning adds a small maintenance burden — developers must update the version
  string when changing prompt content
