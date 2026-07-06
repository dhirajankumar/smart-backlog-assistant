import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import {
  Confidence,
  ExistingBacklogItem,
  ItemStatus,
  OverlapFlag,
  Priority,
  UserStory,
} from '@smart-backlog/shared';
import { AnalyseService } from '../../src/analyse/analyse.service';
import { AiService } from '../../src/ai/ai.service';
import { PdfService } from '../../src/pdf/pdf.service';
import { PdfError } from '../../src/pdf/pdf.validator';
import { OverlapService } from '../../src/overlap/overlap.service';
import { AnalyseDto } from '../../src/analyse/analyse.dto';

// ── helpers ──────────────────────────────────────────────────────────────────

interface SsePayload {
  type: string;
  step?: string;
  payload?: unknown;
  storyId?: string;
  flag?: OverlapFlag;
  reference?: string | null;
}

async function collectEvents(service: AnalyseService, dto: AnalyseDto, pdfBuffer?: Buffer, backlogBuffer?: Buffer): Promise<SsePayload[]> {
  const stream = service.stream(dto, pdfBuffer, backlogBuffer);
  const raw = await firstValueFrom(stream.pipe(toArray()));
  return raw.map((e) => JSON.parse(e.data as string) as SsePayload);
}

function makeSummaryJson() {
  return JSON.stringify({
    bullets: ['Requirement A', 'Requirement B'],
    reviewerNote: null,
    generatedAt: new Date().toISOString(),
    promptVersion: '1.0.0',
  });
}

function makeStoriesJson(overrides: Partial<UserStory>[] = [{}]) {
  return JSON.stringify(
    overrides.map((o) => ({
      title: 'Upload document',
      role: 'product owner',
      benefit: 'analyse requirements',
      acceptanceCriteria: ['AC1', 'AC2'],
      priority: Priority.Medium,
      category: 'Core Workflow',
      confidence: Confidence.High,
      rationale: 'rationale',
      sourceSegment: 0,
      ...o,
    })),
  );
}

const TEXT_DTO: AnalyseDto = { inputType: 'text', textContent: 'Project requirements text' };

// ── tests ────────────────────────────────────────────────────────────────────

describe('AnalyseService', () => {
  let service: AnalyseService;
  let aiService: jest.Mocked<AiService>;
  let pdfService: jest.Mocked<PdfService>;
  let overlapService: jest.Mocked<OverlapService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyseService,
        {
          provide: AiService,
          useValue: { complete: jest.fn() },
        },
        {
          provide: PdfService,
          useValue: { extract: jest.fn() },
        },
        {
          provide: OverlapService,
          useValue: {
            detectSessionDuplicates: jest.fn((s: UserStory[]) => s),
            detectExistingOverlaps: jest.fn((s: UserStory[]) => s),
          },
        },
      ],
    }).compile();

    service = module.get(AnalyseService);
    aiService = module.get(AiService) as jest.Mocked<AiService>;
    pdfService = module.get(PdfService) as jest.Mocked<PdfService>;
    overlapService = module.get(OverlapService) as jest.Mocked<OverlapService>;
  });

  // ── happy path — text input ───────────────────────────────────────────────

  describe('stream — text input happy path', () => {
    beforeEach(() => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());
    });

    it('emits progress steps in the correct order', async () => {
      const events = await collectEvents(service, TEXT_DTO);
      const steps = events
        .filter((e) => e.type === 'progress')
        .map((e) => e.step);
      expect(steps).toEqual([
        'extracting_text',
        'validating_backlog',
        'analysing_requirements',
        'generating_stories',
        'detecting_overlaps',
        'complete',
      ]);
    });

    it('emits a summary event before any story events', async () => {
      const events = await collectEvents(service, TEXT_DTO);
      const summaryIdx = events.findIndex((e) => e.type === 'summary');
      const storyIdx = events.findIndex((e) => e.type === 'story');
      expect(summaryIdx).toBeGreaterThanOrEqual(0);
      expect(storyIdx).toBeGreaterThan(summaryIdx);
    });

    it('emits one story event per story returned by the AI', async () => {
      const events = await collectEvents(service, TEXT_DTO);
      const storyEvents = events.filter((e) => e.type === 'story');
      expect(storyEvents).toHaveLength(1);
    });

    it('story events contain all required UserStory fields', async () => {
      const events = await collectEvents(service, TEXT_DTO);
      const storyPayload = events.find((e) => e.type === 'story')?.payload as UserStory;
      expect(storyPayload.id).toBeDefined();
      expect(storyPayload.status).toBe(ItemStatus.Draft);
      expect(storyPayload.overlapFlag).toBe(OverlapFlag.None);
      expect(storyPayload.promptVersion).toBe('1.0.0');
    });

    it('does not call pdfService.extract for text input', async () => {
      await collectEvents(service, TEXT_DTO);
      expect(pdfService.extract).not.toHaveBeenCalled();
    });

    it('calls aiService.complete exactly twice (summary + stories)', async () => {
      await collectEvents(service, TEXT_DTO);
      expect(aiService.complete).toHaveBeenCalledTimes(2);
    });

    it('calls overlapService.detectSessionDuplicates with the generated stories', async () => {
      await collectEvents(service, TEXT_DTO);
      expect(overlapService.detectSessionDuplicates).toHaveBeenCalledWith(expect.any(Array));
    });

    it('does not emit an error event on success', async () => {
      const events = await collectEvents(service, TEXT_DTO);
      expect(events.some((e) => e.type === 'error')).toBe(false);
    });
  });

  // ── happy path — multiple stories ────────────────────────────────────────

  it('emits one story event per story when the AI returns multiple stories', async () => {
    aiService.complete
      .mockResolvedValueOnce(makeSummaryJson())
      .mockResolvedValueOnce(makeStoriesJson([{}, { title: 'Export report' }, { title: 'Review items' }]));

    const events = await collectEvents(service, TEXT_DTO);
    expect(events.filter((e) => e.type === 'story')).toHaveLength(3);
  });

  // ── happy path — PDF input ────────────────────────────────────────────────

  describe('stream — PDF input', () => {
    it('extracts text from PDF and proceeds with analysis', async () => {
      pdfService.extract.mockResolvedValueOnce({ text: 'Extracted PDF text', wordCount: 3, segments: ['Extracted PDF text'], segmentCount: 1 });
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());

      const events = await collectEvents(service, { inputType: 'pdf' }, Buffer.from('pdf-bytes'));
      expect(pdfService.extract).toHaveBeenCalled();
      expect(events.some((e) => e.type === 'story')).toBe(true);
    });

    it('emits PDF_EXTRACT_FAILED when no pdf buffer is provided', async () => {
      const events = await collectEvents(service, { inputType: 'pdf' });
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('PDF_EXTRACT_FAILED');
    });

    it('emits the PdfError code when pdfService.extract throws a PdfError', async () => {
      pdfService.extract.mockRejectedValueOnce(new PdfError('PDF_IMAGE_ONLY', 'Image-only PDF'));
      aiService.complete.mockResolvedValue(makeSummaryJson());

      const events = await collectEvents(service, { inputType: 'pdf' }, Buffer.from('pdf'));
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('PDF_IMAGE_ONLY');
    });
  });

  // ── backlog JSON validation ───────────────────────────────────────────────

  describe('stream — backlog JSON validation', () => {
    it('emits BACKLOG_SCHEMA_INVALID when the buffer contains non-JSON', async () => {
      const events = await collectEvents(service, TEXT_DTO, undefined, Buffer.from('not-json'));
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('BACKLOG_SCHEMA_INVALID');
    });

    it('emits BACKLOG_SCHEMA_INVALID when JSON is not an array', async () => {
      const events = await collectEvents(service, TEXT_DTO, undefined, Buffer.from('{"title":"x"}'));
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('BACKLOG_SCHEMA_INVALID');
    });

    it('emits BACKLOG_SCHEMA_INVALID when an array item lacks a title string', async () => {
      const events = await collectEvents(service, TEXT_DTO, undefined, Buffer.from('[{"description":"x"}]'));
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('BACKLOG_SCHEMA_INVALID');
    });

    it('proceeds normally when the backlog JSON is a valid array of items with title', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());
      const existing: ExistingBacklogItem[] = [{ title: 'Existing item' }];
      const events = await collectEvents(service, TEXT_DTO, undefined, Buffer.from(JSON.stringify(existing)));
      expect(events.some((e) => e.type === 'story')).toBe(true);
      expect(overlapService.detectExistingOverlaps).toHaveBeenCalledWith(expect.any(Array), existing);
    });
  });

  // ── AI error handling ─────────────────────────────────────────────────────

  describe('stream — AI error handling', () => {
    it('emits AI_TIMEOUT when the AI call throws an AbortError', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      aiService.complete.mockRejectedValueOnce(abortErr);

      const events = await collectEvents(service, TEXT_DTO);
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('AI_TIMEOUT');
    });

    it('emits AI_MALFORMED_RESPONSE when the summary AI response is not valid JSON', async () => {
      aiService.complete.mockResolvedValueOnce('not-json');

      const events = await collectEvents(service, TEXT_DTO);
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('AI_MALFORMED_RESPONSE');
    });

    it('emits AI_MALFORMED_RESPONSE when the story generation response is not valid JSON', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce('not-json');

      const events = await collectEvents(service, TEXT_DTO);
      const errEvent = events.find((e) => e.type === 'error');
      expect((errEvent?.payload as { code: string })?.code).toBe('AI_MALFORMED_RESPONSE');
    });

    it('emits an error event then completes (does not hang) on AI failure', async () => {
      aiService.complete.mockRejectedValueOnce(new Error('network error'));

      const events = await collectEvents(service, TEXT_DTO);
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });
  });

  // ── overlap detection ─────────────────────────────────────────────────────

  describe('stream — overlap events', () => {
    it('emits overlap_update for each flagged story after detection', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson([{}, {}]));

      overlapService.detectSessionDuplicates.mockImplementation((stories: UserStory[]) => {
        if (stories[1]) {
          stories[1].overlapFlag = OverlapFlag.SessionDuplicate;
          stories[1].overlapReference = stories[0].title;
        }
        return stories;
      });

      const events = await collectEvents(service, TEXT_DTO);
      const updateEvents = events.filter((e) => e.type === 'overlap_update');
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0].flag).toBe(OverlapFlag.SessionDuplicate);
    });

    it('does not emit overlap_update for stories with OverlapFlag.None', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());

      const events = await collectEvents(service, TEXT_DTO);
      expect(events.filter((e) => e.type === 'overlap_update')).toHaveLength(0);
    });

    it('calls detectExistingOverlaps when existing items are present', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());
      const existing = [{ title: 'Existing' }];

      await collectEvents(service, TEXT_DTO, undefined, Buffer.from(JSON.stringify(existing)));

      expect(overlapService.detectExistingOverlaps).toHaveBeenCalledTimes(1);
    });

    it('skips detectExistingOverlaps when no existing items provided', async () => {
      aiService.complete
        .mockResolvedValueOnce(makeSummaryJson())
        .mockResolvedValueOnce(makeStoriesJson());

      await collectEvents(service, TEXT_DTO);

      expect(overlapService.detectExistingOverlaps).not.toHaveBeenCalled();
    });
  });
});
