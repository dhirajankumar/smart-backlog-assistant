import { requirementsSummaryPrompt } from './requirements-summary.prompt';
import { storyGenerationPrompt } from './story-generation.prompt';
import { taskGenerationPrompt } from './task-generation.prompt';
import { storyRegenerationPrompt } from './story-regeneration.prompt';

export const promptRegistry: Record<string, string> = {
  requirementsSummary: requirementsSummaryPrompt.version,
  storyGeneration: storyGenerationPrompt.version,
  taskGeneration: taskGenerationPrompt.version,
  storyRegeneration: storyRegenerationPrompt.version,
};
