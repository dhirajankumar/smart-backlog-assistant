import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  ExistingBacklogItem,
  ItemStatus,
  KeyRequirementsSummary,
  LIMITS,
  OverlapFlag,
  Priority,
  Confidence,
  UserStory,
} from '@smart-backlog/shared';

import { AiService } from '../ai/ai.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfError } from '../pdf/pdf.validator';
import { OverlapService } from '../overlap/overlap.service';
import { requirementsSummaryPrompt } from '../ai/prompts/requirements-summary.prompt';
import { storyGenerationPrompt } from '../ai/prompts/story-generation.prompt';
import { AnalyseDto } from './analyse.dto';

@Injectable()
export class AnalyseService {
  constructor(
    private readonly aiService: AiService,
    private readonly pdfService: PdfService,
    private readonly overlapService: OverlapService,
  ) {}

  stream(
    dto: AnalyseDto,
    pdfBuffer: Buffer | undefined,
    backlogBuffer: Buffer | undefined,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), LIMITS.ABORT_SIGNAL_MS);

      const emit = (payload: object) =>
        subscriber.next({ data: JSON.stringify(payload) } as MessageEvent);

      (async () => {
        try {
          // Step 1: extract text
          emit({ type: 'progress', step: 'extracting_text' });
          let text: string;

          if (dto.inputType === 'pdf') {
            if (!pdfBuffer) {
              emit({ type: 'error', payload: { code: 'PDF_EXTRACT_FAILED', message: 'No PDF file uploaded' } });
              subscriber.complete();
              return;
            }
            const extracted = await this.pdfService.extract(pdfBuffer);
            text = extracted.text;
          } else {
            text = dto.textContent ?? '';
          }

          // Step 2: validate backlog JSON
          emit({ type: 'progress', step: 'validating_backlog' });
          let existingItems: ExistingBacklogItem[] = [];

          if (backlogBuffer) {
            let raw: unknown;
            try {
              raw = JSON.parse(backlogBuffer.toString('utf-8'));
            } catch {
              emit({ type: 'error', payload: { code: 'BACKLOG_SCHEMA_INVALID', message: 'Backlog file contains invalid JSON' } });
              subscriber.complete();
              return;
            }
            if (!Array.isArray(raw) || (raw as Record<string, unknown>[]).some((item) => typeof item['title'] !== 'string')) {
              emit({ type: 'error', payload: { code: 'BACKLOG_SCHEMA_INVALID', message: 'Backlog JSON must be an array of objects each with a title string field' } });
              subscriber.complete();
              return;
            }
            existingItems = raw as ExistingBacklogItem[];
          }

          // Step 3: requirements summary
          emit({ type: 'progress', step: 'analysing_requirements' });
          let summaryText: string;
          try {
            summaryText = await this.aiService.complete(
              requirementsSummaryPrompt.build({ text }),
              abort.signal,
            );
          } catch (err) {
            emit(this.mapAiError(err as Error));
            subscriber.complete();
            return;
          }

          let summary: KeyRequirementsSummary;
          try {
            summary = JSON.parse(summaryText) as KeyRequirementsSummary;
          } catch {
            emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: 'Requirements summary response was not valid JSON' } });
            subscriber.complete();
            return;
          }
          emit({ type: 'summary', payload: summary });

          // Step 4: story generation
          emit({ type: 'progress', step: 'generating_stories' });
          let storiesText: string;
          try {
            storiesText = await this.aiService.complete(
              storyGenerationPrompt.build({ text, summary, existingItems }),
              abort.signal,
            );
          } catch (err) {
            emit(this.mapAiError(err as Error));
            subscriber.complete();
            return;
          }

          let rawStories: Partial<UserStory>[];
          try {
            const parsed = JSON.parse(storiesText) as Partial<UserStory>[] | { stories: Partial<UserStory>[] };
            rawStories = Array.isArray(parsed) ? parsed : (parsed.stories ?? []);
          } catch {
            emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: 'Story generation response was not valid JSON' } });
            subscriber.complete();
            return;
          }

          const now = new Date().toISOString();
          const stories: UserStory[] = rawStories.map((raw) => ({
            id: uuidv4(),
            title: raw.title ?? '',
            role: raw.role ?? '',
            benefit: raw.benefit ?? '',
            acceptanceCriteria: raw.acceptanceCriteria ?? [],
            priority: (raw.priority ?? Priority.Medium) as Priority,
            category: raw.category ?? '',
            confidence: (raw.confidence ?? Confidence.Medium) as Confidence,
            rationale: raw.rationale ?? '',
            overlapFlag: OverlapFlag.None,
            overlapReference: null,
            status: ItemStatus.Draft,
            originalAiText: null,
            sourceSegment: raw.sourceSegment ?? 0,
            promptVersion: storyGenerationPrompt.version,
            generatedAt: now,
          }));

          for (const story of stories) {
            emit({ type: 'story', payload: story });
          }

          // Step 5: overlap detection
          emit({ type: 'progress', step: 'detecting_overlaps' });

          const withDuplicates = this.overlapService.detectSessionDuplicates([...stories]);
          const withOverlaps =
            existingItems.length > 0
              ? this.overlapService.detectExistingOverlaps(withDuplicates, existingItems)
              : withDuplicates;

          for (const story of withOverlaps) {
            if (story.overlapFlag !== OverlapFlag.None) {
              emit({
                type: 'overlap_update',
                storyId: story.id,
                flag: story.overlapFlag,
                reference: story.overlapReference,
              });
            }
          }

          // Step 6: complete
          emit({ type: 'progress', step: 'complete' });
          subscriber.complete();
        } catch (err) {
          if (err instanceof PdfError) {
            emit({ type: 'error', payload: { code: err.code, message: err.message } });
          } else {
            emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: (err as Error).message } });
          }
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
