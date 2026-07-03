import { InputFormat } from '../enums/input-format.enum';
import { KeyRequirementsSummary } from './key-requirements-summary.entity';
import { ReviewAction } from './review-action.entity';
import { Task } from './task.entity';
import { UserStory } from './user-story.entity';

export interface PublishedBacklog {
  exportVersion: string;
  exportId: string;
  exportTimestamp: string;
  model: string;
  promptVersions: Record<string, string>;
  inputSummary: {
    format: InputFormat;
    filename: string | null;
    wordCount: number;
    submittedAt: string;
  };
  existingBacklogItemCount: number;
  reviewerName: string | null;
  keyRequirementsSummary: KeyRequirementsSummary;
  userStories: (UserStory & { tasks: Task[] })[];
  auditLog: ReviewAction[];
}
