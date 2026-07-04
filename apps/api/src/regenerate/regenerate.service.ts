import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  Confidence,
  ItemStatus,
  LIMITS,
  OverlapFlag,
  Priority,
  Task,
  UserStory,
} from '@smart-backlog/shared';

import { AiService } from '../ai/ai.service';
import { OverlapService } from '../overlap/overlap.service';
import { storyRegenerationPrompt } from '../ai/prompts/story-regeneration.prompt';
import { RegenerateDto } from './regenerate.dto';

@Injectable()
export class RegenerateService {
  constructor(
    private readonly aiService: AiService,
    private readonly overlapService: OverlapService,
  ) {}

  stream(dto: RegenerateDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), LIMITS.ABORT_SIGNAL_MS);

      const emit = (payload: object) =>
        subscriber.next({ data: JSON.stringify(payload) } as MessageEvent);

      (async () => {
        try {
          emit({ type: 'progress', step: 'regenerating' });

          let raw: string;
          try {
            raw = await this.aiService.complete(
              storyRegenerationPrompt.build({
                targetType: dto.targetType,
                target: dto.target,
                feedback: dto.feedback,
                parentStory: dto.parentStory,
                existingItems: dto.existingBacklogItems ?? [],
              }),
              abort.signal,
            );
          } catch (err) {
            emit(this.mapAiError(err as Error));
            subscriber.complete();
            return;
          }

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: 'Regenerated item response was not valid JSON' } });
            subscriber.complete();
            return;
          }

          const now = new Date().toISOString();

          if (dto.targetType === 'story') {
            const original = dto.target as UserStory;
            const story: UserStory = {
              id: uuidv4(),
              title: (parsed['title'] as string) ?? '',
              role: (parsed['role'] as string) ?? '',
              benefit: (parsed['benefit'] as string) ?? '',
              acceptanceCriteria: (parsed['acceptanceCriteria'] as string[]) ?? [],
              priority: ((parsed['priority'] as string) ?? Priority.Medium) as Priority,
              category: (parsed['category'] as string) ?? original.category,
              confidence: ((parsed['confidence'] as string) ?? Confidence.Medium) as Confidence,
              rationale: (parsed['rationale'] as string) ?? '',
              overlapFlag: OverlapFlag.None,
              overlapReference: null,
              status: ItemStatus.Draft,
              originalAiText: null,
              sourceSegment: (parsed['sourceSegment'] as number) ?? original.sourceSegment,
              promptVersion: storyRegenerationPrompt.version,
              generatedAt: now,
            };

            emit({ type: 'story', payload: story });

            const existingItems = dto.existingBacklogItems ?? [];
            if (existingItems.length > 0) {
              const withOverlaps = this.overlapService.detectExistingOverlaps([story], existingItems);
              if (withOverlaps[0].overlapFlag !== OverlapFlag.None) {
                emit({
                  type: 'overlap_update',
                  storyId: story.id,
                  flag: withOverlaps[0].overlapFlag,
                  reference: withOverlaps[0].overlapReference,
                });
              }
            }
          } else {
            const original = dto.target as Task;
            const task: Task = {
              id: uuidv4(),
              storyId: original.storyId,
              title: (parsed['title'] as string) ?? '',
              description: (parsed['description'] as string) ?? '',
              priority: ((parsed['priority'] as string) ?? Priority.Medium) as Priority,
              category: (parsed['category'] as string) ?? original.category,
              confidence: ((parsed['confidence'] as string) ?? Confidence.Medium) as Confidence,
              rationale: (parsed['rationale'] as string) ?? '',
              overlapFlag: OverlapFlag.None,
              overlapReference: null,
              status: ItemStatus.Draft,
              originalAiText: null,
              promptVersion: storyRegenerationPrompt.version,
              generatedAt: now,
            };

            emit({ type: 'task', payload: task });
          }

          emit({ type: 'complete' });
          subscriber.complete();
        } catch (err) {
          emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: (err as Error).message } });
          subscriber.complete();
        } finally {
          clearTimeout(timer);
        }
      })().catch((err: Error) => subscriber.error(err));

      return () => {
        abort.abort();
        clearTimeout(timer);
      };
    });
  }

  private mapAiError(err: Error): object {
    if (err.name === 'AbortError') {
      return { type: 'error', payload: { code: 'AI_TIMEOUT', message: 'AI request timed out after 58 seconds' } };
    }
    return { type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: err.message } };
  }
}
