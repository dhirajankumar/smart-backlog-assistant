import type { ExistingBacklogItem, Task, UserStory } from '@smart-backlog/shared';

export const storyRegenerationPrompt = {
  version: '1.0.0',

  build({
    targetType,
    target,
    feedback,
    parentStory,
    existingItems = [],
  }: {
    targetType: 'story' | 'task';
    target: UserStory | Task;
    feedback: string;
    parentStory?: UserStory;
    existingItems?: ExistingBacklogItem[];
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

    const parentSection = parentStory
      ? [
          '--- PARENT USER STORY ---',
          JSON.stringify(parentStory, null, 2),
          '--- END PARENT STORY ---',
          '',
        ].join('\n')
      : '';

    const itemType = targetType === 'story' ? 'user story' : 'task';
    const responseShape =
      targetType === 'story'
        ? '  title (string), role (string), benefit (string), acceptanceCriteria (string[], min 2), priority ("High"|"Medium"|"Low"), category (string), confidence ("High"|"Medium"|"Low"), rationale (string), sourceSegment (number)'
        : '  title (string), description (string), priority ("High"|"Medium"|"Low"), category (string), confidence ("High"|"Medium"|"Low"), rationale (string)';

    return [
      `You are a senior product manager. Regenerate the following ${itemType} based on the reviewer's feedback.`,
      `Return ONLY a JSON object with the revised ${itemType} fields (no markdown, no explanation).`,
      `Required fields: ${responseShape}`,
      '',
      '--- ORIGINAL ITEM ---',
      JSON.stringify(target, null, 2),
      '--- END ORIGINAL ITEM ---',
      '',
      parentSection,
      existingSection,
      '--- REVIEWER FEEDBACK ---',
      feedback,
      '--- END FEEDBACK ---',
    ].join('\n');
  },
} as const;
