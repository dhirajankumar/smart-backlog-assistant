import { Confidence } from '../enums/confidence.enum';
import { ItemStatus } from '../enums/status.enum';
import { OverlapFlag } from '../enums/overlap-flag.enum';
import { Priority } from '../enums/priority.enum';

export interface Task {
  id: string;
  storyId: string;
  title: string;
  description: string;
  priority: Priority;
  category: string;
  confidence: Confidence;
  rationale: string;
  overlapFlag: OverlapFlag;
  overlapReference: string | null;
  status: ItemStatus;
  originalAiText: Omit<Task, 'status' | 'originalAiText'> | null;
  promptVersion: string;
  generatedAt: string;
}
