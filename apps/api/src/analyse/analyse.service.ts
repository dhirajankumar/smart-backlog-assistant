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
  Task,
  UserStory,
} from '@smart-backlog/shared';

import { AiService } from '../ai/ai.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfError } from '../pdf/pdf.validator';
import { OverlapService } from '../overlap/overlap.service';
import { GithubProjectsContextService } from '../github-projects/github-projects-context.service';
import { GithubProjectsService } from '../github-projects/github-projects.service';
import { requirementsSummaryPrompt } from '../ai/prompts/requirements-summary.prompt';
import { storyGenerationPrompt } from '../ai/prompts/story-generation.prompt';
import { AnalyseDto, AnalyseTasksDto } from './analyse.dto';
import { AppLogger } from '../common/logger/app-logger.service';

@Injectable()
export class AnalyseService {
  constructor(
    private readonly aiService: AiService,
    private readonly pdfService: PdfService,
    private readonly overlapService: OverlapService,
    private readonly githubContextService: GithubProjectsContextService,
    private readonly githubProjectsService: GithubProjectsService,
    private readonly logger: AppLogger,
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
          this.logger.log('Step: extracting_text', 'AnalyseService');
          emit({ type: 'progress', step: 'extracting_text' });
          let text: string;

          if (dto.inputType === 'pdf') {
            if (!pdfBuffer) {
              this.logger.error('Step extracting_text failed: no PDF buffer', undefined, 'AnalyseService');
              emit({ type: 'error', payload: { code: 'PDF_EXTRACT_FAILED', message: 'No PDF file uploaded' } });
              subscriber.complete();
              return;
            }
            const extracted = await this.pdfService.extract(pdfBuffer);
            text = extracted.text;
          } else {
            text = dto.textContent ?? '';
          }

          if (!text.trim()) {
            this.logger.error('Step extracting_text failed: empty input', undefined, 'AnalyseService');
            emit({ type: 'error', payload: { code: 'EMPTY_INPUT', message: 'No requirements could be extracted: the input document is empty' } });
            subscriber.complete();
            return;
          }

          // Step 2: validate backlog JSON or fetch live GitHub context
          this.logger.log('Step: validating_backlog', 'AnalyseService');
          emit({ type: 'progress', step: 'validating_backlog' });
          let existingItems: ExistingBacklogItem[] = [];

          if (dto.backlogSourceType === 'live-github') {
            const connection = this.githubProjectsService.getStatus();
            if (connection.status === 'active') {
              try {
                emit({ type: 'progress', step: 'github_context_fetch', message: 'Fetching GitHub Projects context…', itemCount: null });
                const { items, truncated } = await this.githubContextService.fetchItems(connection.owner, connection.projectNumber);
                existingItems = items.map(i => ({ title: i.title, description: i.body ?? undefined }));
                if (truncated) {
                  emit({ type: 'progress', step: 'github_context_truncated', message: `Context limited to 200 most-recent items`, itemCount: 200 });
                } else {
                  emit({ type: 'progress', step: 'github_context_ready', message: `GitHub Projects context loaded (${items.length} items)`, itemCount: items.length });
                }
              } catch (err) {
                emit({ type: 'connection_error', source: 'github_mcp', message: 'GitHub connection failed — falling back to manual upload', fallbackEnabled: true });
                // Fall through without existing items
              }
            }
          } else if (backlogBuffer) {
            let raw: unknown;
            try {
              raw = JSON.parse(backlogBuffer.toString('utf-8'));
            } catch {
              this.logger.error('BACKLOG_SCHEMA_INVALID: Backlog file contains invalid JSON', undefined, 'AnalyseService');
              emit({ type: 'error', payload: { code: 'BACKLOG_SCHEMA_INVALID', message: 'Backlog file contains invalid JSON' } });
              subscriber.complete();
              return;
            }
            if (!Array.isArray(raw) || (raw as Record<string, unknown>[]).some((item) => typeof item['title'] !== 'string')) {
              this.logger.error('BACKLOG_SCHEMA_INVALID: Backlog JSON must be an array of objects each with a title string field', undefined, 'AnalyseService');
              emit({ type: 'error', payload: { code: 'BACKLOG_SCHEMA_INVALID', message: 'Backlog JSON must be an array of objects each with a title string field' } });
              subscriber.complete();
              return;
            }
            existingItems = raw as ExistingBacklogItem[];
          }

          // Step 3: requirements summary
          this.logger.log('Step: analysing_requirements', 'AnalyseService');
          emit({ type: 'progress', step: 'analysing_requirements' });
          let summaryText: string;
          try {
            summaryText = await this.aiService.complete(
              requirementsSummaryPrompt.build({ text }),
              abort.signal,
            );
          } catch (err) {
            this.logger.error(`AI error in analysing_requirements: ${(err as Error).message}`, undefined, 'AnalyseService');
            emit(this.mapAiError(err as Error));
            subscriber.complete();
            return;
          }

          let summary: KeyRequirementsSummary;
          try {
            summary = JSON.parse(summaryText) as KeyRequirementsSummary;
          } catch {
            this.logger.error('AI_MALFORMED_RESPONSE: Requirements summary response was not valid JSON', undefined, 'AnalyseService');
            emit({ type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: 'Requirements summary response was not valid JSON' } });
            subscriber.complete();
            return;
          }
          emit({ type: 'summary', payload: summary });

          // Step 4: story generation
          this.logger.log('Step: generating_stories', 'AnalyseService');
          emit({ type: 'progress', step: 'generating_stories' });
          let storiesText: string;
          try {
            storiesText = await this.aiService.complete(
              storyGenerationPrompt.build({ text, summary, existingItems }),
              abort.signal,
            );
          } catch (err) {
            this.logger.error(`AI error in generating_stories: ${(err as Error).message}`, undefined, 'AnalyseService');
            emit(this.mapAiError(err as Error));
            subscriber.complete();
            return;
          }

          let rawStories: Partial<UserStory>[];
          try {
            const parsed = JSON.parse(storiesText) as Partial<UserStory>[] | { stories: Partial<UserStory>[] };
            rawStories = Array.isArray(parsed) ? parsed : (parsed.stories ?? []);
          } catch {
            this.logger.error('AI_MALFORMED_RESPONSE: Story generation response was not valid JSON', undefined, 'AnalyseService');
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
          this.logger.log('Step: detecting_overlaps', 'AnalyseService');
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
          this.logger.log('Step: complete', 'AnalyseService');
          emit({ type: 'progress', step: 'complete' });
          subscriber.complete();
        } catch (err) {
          this.logger.error(`Unhandled error: ${(err as Error).message}`, undefined, 'AnalyseService');
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

  async generateTasks(_dto: AnalyseTasksDto): Promise<Task[]> {
    // Full implementation delivered in T030
    return [];
  }

  private mapAiError(err: Error): object {
    if (err.name === 'AbortError') {
      return { type: 'error', payload: { code: 'AI_TIMEOUT', message: 'AI request timed out after 58 seconds' } };
    }
    return { type: 'error', payload: { code: 'AI_MALFORMED_RESPONSE', message: err.message } };
  }
}
