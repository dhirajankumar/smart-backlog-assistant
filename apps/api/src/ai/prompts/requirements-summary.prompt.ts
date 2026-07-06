export const requirementsSummaryPrompt = {
  version: '1.0.0',

  build({ text }: { text: string }): string {
    return [
      'You are a business analyst. Extract the key requirements from the following input document.',
      'Return ONLY a JSON object in this exact shape (no markdown, no explanation):',
      '{ "bullets": ["<requirement>", ...], "reviewerNote": null, "generatedAt": "<ISO-8601>", "promptVersion": "1.0.0" }',
      'Include at least 2 and at most 10 bullets. Each bullet is a single concise requirement statement.',
      '',
      '--- INPUT DOCUMENT ---',
      text,
      '--- END ---',
    ].join('\n');
  },
} as const;
