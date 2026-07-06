import { Confidence } from '../enums/confidence.enum';
import { OverlapFlag } from '../enums/overlap-flag.enum';
import { Priority } from '../enums/priority.enum';
import { ItemStatus } from '../enums/status.enum';

export interface UserStory {
  id: string;
  title: string;
  role: string;
  benefit: string;
  acceptanceCriteria: string[];
  priority: Priority;
  category: string;
  confidence: Confidence;
  rationale: string;
  overlapFlag: OverlapFlag;
  overlapReference: string | null;
  status: ItemStatus;
  originalAiText: Omit<UserStory, 'status' | 'originalAiText'> | null;
  sourceSegment: number;
  promptVersion: string;
  generatedAt: string;
}
