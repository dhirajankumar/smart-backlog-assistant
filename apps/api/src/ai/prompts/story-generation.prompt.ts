import type { ExistingBacklogItem, KeyRequirementsSummary } from '@smart-backlog/shared';

export const storyGenerationPrompt = {
  version: '1.0.0',

  build({
    text,
    summary,
    existingItems,
  }: {
    text: string;
    summary: KeyRequirementsSummary;
    existingItems: ExistingBacklogItem[];
  }): string {
    const existingSection =
      existingItems.length > 0
        ? [
            '--- EXISTING BACKLOG (do not duplicate these items) ---',
            JSON.stringify(existingItems, null, 2),
            '--- END EXISTING BACKLOG ---',
            '',
          ].join('\n')
        : '';

    return [
      'You are a senior product manager. Generate user stories from the input document and requirements summary.',
      'Return ONLY a JSON array of user story objects (no markdown, no explanation).',
      'Each object must have these fields:',
      '  title (string), role (string), benefit (string), acceptanceCriteria (string[], min 2),',
      '  priority ("High"|"Medium"|"Low"), category (string), confidence ("High"|"Medium"|"Low"),',
      '  rationale (string), sourceSegment (number, 0-based)',
      '',
      '--- KEY REQUIREMENTS SUMMARY ---',
      JSON.stringify(summary.bullets, null, 2),
      '--- END SUMMARY ---',
      '',
      existingSection,
      '--- INPUT DOCUMENT ---',
      text,
      '--- END ---',
    ].join('\n');
  },
} as const;
