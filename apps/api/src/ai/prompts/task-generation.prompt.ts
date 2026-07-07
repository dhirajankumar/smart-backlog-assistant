import type { ExistingBacklogItem, UserStory } from '@smart-backlog/shared';

export const taskGenerationPrompt = {
  version: '1.0.0',

  build({
    story,
    existingItems = [],
  }: {
    story: UserStory;
    existingItems?: ExistingBacklogItem[];
  }): string {
    const existingSection =
      existingItems.length > 0
        ? [
            '--- EXISTING BACKLOG (do not duplicate these tasks) ---',
            JSON.stringify(existingItems, null, 2),
            '--- END EXISTING BACKLOG ---',
            '',
          ].join('\n')
        : '';

    return [
      'You are a senior product manager. Generate concrete implementation tasks for the following approved user story.',
      'Return ONLY a JSON array of task objects (no markdown, no explanation).',
      'Each task object must have these fields:',
      '  title (string), description (string),',
      '  priority ("High"|"Medium"|"Low"), category (string), confidence ("High"|"Medium"|"Low"),',
      '  rationale (string)',
      '',
      '--- USER STORY ---',
      JSON.stringify(story, null, 2),
      '--- END USER STORY ---',
      '',
      existingSection,
    ].join('\n');
  },
} as const;
