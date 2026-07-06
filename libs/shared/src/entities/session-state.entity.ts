import { SessionStatus } from '../enums/session-status.enum';
import { ExistingBacklogItem } from './existing-backlog-item.entity';
import { InputDocument } from './input-document.entity';
import { KeyRequirementsSummary } from './key-requirements-summary.entity';
import { ReviewAction } from './review-action.entity';
import { Task } from './task.entity';
import { UserStory } from './user-story.entity';

export interface SessionState {
  status: SessionStatus;
  inputDocument: InputDocument | null;
  existingBacklogItems: ExistingBacklogItem[];
  requirementsSummary: KeyRequirementsSummary | null;
  stories: UserStory[];
  tasks: Record<string, Task[]>;
  activeStoryId: string | null;
  auditLog: ReviewAction[];
  analysisStartedAt: number | null;
  promptVersions: Record<string, string>;
  analysisError: { code: string; message: string } | null;
  reviewerName: string | null;
}
