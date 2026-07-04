import {
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { ExistingBacklogItem, Task, UserStory } from '@smart-backlog/shared';

export class RegenerateDto {
  @IsIn(['story', 'task'])
  targetType: 'story' | 'task';

  @IsDefined()
  @IsObject()
  target: UserStory | Task;

  @IsString()
  @MinLength(1)
  feedback: string;

  @IsObject()
  @IsOptional()
  parentStory?: UserStory;

  @IsArray()
  @IsOptional()
  existingBacklogItems?: ExistingBacklogItem[];
}
