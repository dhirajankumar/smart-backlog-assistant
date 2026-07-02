import {
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ExistingBacklogItem, UserStory } from '@smart-backlog/shared';
import { Confidence, ItemStatus, OverlapFlag, Priority } from '@smart-backlog/shared';

/**
 * Validates the nested UserStory object sent to POST /api/analyse/tasks.
 * Mirrors the UserStory interface from @smart-backlog/shared with class-validator decorators.
 */
class UserStoryDto implements UserStory {
  @IsUUID()
  id: string;

  @IsString()
  title: string;

  @IsString()
  role: string;

  @IsString()
  benefit: string;

  @IsArray()
  @IsString({ each: true })
  acceptanceCriteria: string[];

  @IsIn(Object.values(Priority))
  priority: Priority;

  @IsString()
  category: string;

  @IsIn(Object.values(Confidence))
  confidence: Confidence;

  @IsString()
  rationale: string;

  @IsIn(Object.values(OverlapFlag))
  overlapFlag: OverlapFlag;

  @IsString()
  @IsOptional()
  overlapReference: string | null;

  @IsIn(Object.values(ItemStatus))
  status: ItemStatus;

  @IsObject()
  @IsOptional()
  originalAiText: Omit<UserStory, 'status' | 'originalAiText'> | null;

  @IsNumber()
  sourceSegment: number;

  @IsString()
  promptVersion: string;

  @IsString()
  generatedAt: string;
}

class ExistingBacklogItemDto implements ExistingBacklogItem {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class AnalyseDto {
  @IsIn(['text', 'pdf'])
  inputType: 'text' | 'pdf';

  @IsString()
  @IsOptional()
  textContent?: string;
}

export class AnalyseTasksDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UserStoryDto)
  story: UserStory;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExistingBacklogItemDto)
  existingBacklogItems?: ExistingBacklogItem[];
}
