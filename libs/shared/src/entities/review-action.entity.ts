import { ActionType } from '../enums/action-type.enum';

export interface ReviewAction {
  id: string;
  actionType: ActionType;
  targetType: 'story' | 'task';
  targetId: string;
  content: string | null;
  timestamp: string;
}
