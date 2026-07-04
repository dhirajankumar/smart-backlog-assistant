import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { firstValueFrom, toArray } from 'rxjs';
import {
  Confidence,
  ItemStatus,
  OverlapFlag,
  Priority,
} from '@smart-backlog/shared';
import { AnalyseModule } from '../../src/analyse/analyse.module';
import { AnalyseService } from '../../src/analyse/analyse.service';
import { AiService } from '../../src/ai/ai.service';

// ── SSE helpers ───────────────────────────────────────────────────────────────

interface SseEvent {
  type: string;
  step?: string;
  payload?: Record<string, unknown>;
  storyId?: string;
  flag?: string;
  reference?: string | null;
}

/** Parse a raw SSE body (line-delimited "data: <json>") into event objects. */
function parseSseBody(raw: string): SseEvent[] {
  return raw
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as SseEvent);
}

// ── AI fixture data ───────────────────────────────────────────────────────────

const REQUIREMENTS_SUMMARY_JSON = JSON.stringify({
  bullets: [
    'Users need to upload PDF documents for AI-driven analysis',
    'System must extract text and generate user stories with acceptance criteria',
  ],
  reviewerNote: null,
  generatedAt: '2026-07-03T00:00:00.000Z',
  promptVersion: '1.0.0',
});

const STORY_FIXTURE = {
  title: 'Upload Requirements Document',
  role: 'product owner',
  benefit: 'get AI-driven analysis of project requirements without manual effort',
  acceptanceCriteria: [
    'User can paste plain text or upload a PDF up to 10 MB',
    'Progress indicator updates for each analysis step',
  ],
  priority: Priority.High,
  category: 'Core Workflow',
  confidence: Confidence.High,
  rationale: 'Core user need identified in discovery sessions',
  sourceSegment: 0,
};

const STORIES_JSON = JSON.stringify([STORY_FIXTURE]);

const INPUT_TEXT =
  'We need a document upload feature. Users should be able to paste text or upload a PDF. ' +
  'The system extracts requirements and generates user stories with acceptance criteria and priority.';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Drives AnalyseService.stream() directly and collects all SSE events. */
async function streamServiceEvents(
  service: AnalyseService,
  textContent: string,
  backlogBuffer?: Buffer,
): Promise<SseEvent[]> {
  const raw = await firstValueFrom(
    service
      .stream({ inputType: 'text', textContent }, undefined, backlogBuffer)
      .pipe(toArray()),
  );
  return raw.map((e) => JSON.parse(e.data as string) as SseEvent);
}

// ═════════════════════════════════════════════════════════════════════════════
// US1 — Service-level integration (real PdfService + OverlapService, mock AI)
// ═════════════════════════════════════════════════════════════════════════════
//
// Bootstraps the full AnalyseModule with real PdfService and OverlapService.
// Only AiService is mocked. These tests exercise the integration between the
// service and its collaborators, going beyond what unit tests cover.

describe('US1 — AnalyseModule integration (service-level)', () => {
  let module: TestingModule;
  let service: AnalyseService;
  let aiService: AiService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AnalyseModule],
    }).compile();

    service = module.get(AnalyseService);
    aiService = module.get(AiService);
  });

  afterAll(async () => {
    await module.close();
  });

  // ── Happy path: text input, no existing backlog ───────────────────────────

  describe('happy path — text input, no existing backlog', () => {
    let events: SseEvent[];
    let completeSpy: jest.SpyInstance;

    beforeAll(async () => {
      completeSpy = jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REQUIREMENTS_SUMMARY_JSON) // call 1: requirements summary
        .mockResolvedValueOnce(STORIES_JSON); // call 2: story generation

      events = await streamServiceEvents(service, INPUT_TEXT);
    });

    afterAll(() => {
      completeSpy.mockRestore();
    });

    it('emits all six progress steps in correct order', () => {
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

    it('emits a summary event between analysing_requirements and generating_stories', () => {
      const summaryIdx = events.findIndex((e) => e.type === 'summary');
      const analysingIdx = events.findIndex(
        (e) => e.type === 'progress' && e.step === 'analysing_requirements',
      );
      const generatingIdx = events.findIndex(
        (e) => e.type === 'progress' && e.step === 'generating_stories',
      );
      expect(summaryIdx).toBeGreaterThan(analysingIdx);
      expect(summaryIdx).toBeLessThan(generatingIdx);
    });

    it('summary payload contains the bullets from the AI response', () => {
      const summaryEvent = events.find((e) => e.type === 'summary');
      expect(summaryEvent?.payload).toMatchObject({
        bullets: expect.arrayContaining([
          'Users need to upload PDF documents for AI-driven analysis',
        ]),
      });
    });

    it('emits exactly one story event', () => {
      expect(events.filter((e) => e.type === 'story')).toHaveLength(1);
    });

    it('story event contains all required UserStory fields', () => {
      const story = events.find((e) => e.type === 'story')?.payload;
      expect(story).toMatchObject({
        id: expect.any(String),
        title: STORY_FIXTURE.title,
        role: STORY_FIXTURE.role,
        benefit: STORY_FIXTURE.benefit,
        acceptanceCriteria: expect.arrayContaining([
          'User can paste plain text or upload a PDF up to 10 MB',
        ]),
        priority: Priority.High,
        category: 'Core Workflow',
        confidence: Confidence.High,
        overlapFlag: OverlapFlag.None,
        overlapReference: null,
        status: ItemStatus.Draft,
        originalAiText: null,
        promptVersion: expect.any(String),
        generatedAt: expect.any(String),
      });
    });

    it('story id is a valid UUID v4', () => {
      const id = events.find((e) => e.type === 'story')?.payload?.['id'] as string;
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('story event is emitted before the detecting_overlaps progress step', () => {
      const storyIdx = events.findIndex((e) => e.type === 'story');
      const overlapsIdx = events.findIndex(
        (e) => e.type === 'progress' && e.step === 'detecting_overlaps',
      );
      expect(storyIdx).toBeLessThan(overlapsIdx);
    });

    it('final event is progress step=complete', () => {
      expect(events[events.length - 1]).toEqual({ type: 'progress', step: 'complete' });
    });

    it('does not emit any error event', () => {
      expect(events.some((e) => e.type === 'error')).toBe(false);
    });

    it('calls AiService.complete exactly twice (summary then stories)', () => {
      expect(completeSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── Happy path: text input with existing backlog triggers overlap detection ─

  describe('happy path — existing backlog triggers overlap detection', () => {
    let events: SseEvent[];

    // The existing item's title + description mirrors the story's title + benefit
    // so that tokenized-IoU = 1.0, reliably above the 0.6 threshold.
    const EXISTING_TITLE = STORY_FIXTURE.title;
    const existingBacklog = JSON.stringify([
      {
        title: EXISTING_TITLE,
        description: STORY_FIXTURE.benefit, // same tokens as story benefit
        priority: 'High',
        category: 'Core Workflow',
      },
    ]);

    beforeAll(async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REQUIREMENTS_SUMMARY_JSON)
        .mockResolvedValueOnce(STORIES_JSON);

      events = await streamServiceEvents(
        service,
        INPUT_TEXT,
        Buffer.from(existingBacklog),
      );
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('emits exactly one overlap_update event', () => {
      expect(events.filter((e) => e.type === 'overlap_update')).toHaveLength(1);
    });

    it('overlap_update flag is existing_overlap', () => {
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.flag).toBe(OverlapFlag.ExistingOverlap);
    });

    it('overlap_update reference is the existing item title', () => {
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.reference).toBe(EXISTING_TITLE);
    });

    it('overlap_update storyId matches the story emitted earlier', () => {
      const storyId = events.find((e) => e.type === 'story')?.payload?.['id'];
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.storyId).toBe(storyId);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// US1 — HTTP integration (full NestJS pipeline via supertest, POST /analyse)
// ═════════════════════════════════════════════════════════════════════════════

describe('US1 — POST /analyse HTTP integration', () => {
  let app: INestApplication;
  let aiService: AiService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AnalyseModule],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    aiService = mod.get(AiService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('happy path — text input, no backlog', () => {
    let res: { status: number; headers: Record<string, string>; text: string };
    let events: SseEvent[];

    beforeAll(async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REQUIREMENTS_SUMMARY_JSON)
        .mockResolvedValueOnce(STORIES_JSON);

      res = (await request(app.getHttpServer())
        .post('/analyse')
        .field('inputType', 'text')
        .field('textContent', INPUT_TEXT)
        .buffer(true)) as unknown as { status: number; headers: Record<string, string>; text: string };

      events = parseSseBody(res.text);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('response Content-Type is text/event-stream', () => {
      expect((res.headers as Record<string, string>)['content-type']).toMatch(/text\/event-stream/);
    });

    it('streams all six progress steps in correct order', () => {
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

    it('streams a summary event with bullets', () => {
      const summaryEvent = events.find((e) => e.type === 'summary');
      expect(summaryEvent?.payload).toMatchObject({
        bullets: expect.any(Array),
      });
    });

    it('streams a story event with a UUID id and required fields', () => {
      const story = events.find((e) => e.type === 'story')?.payload;
      expect(story).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        title: STORY_FIXTURE.title,
        priority: Priority.High,
        confidence: Confidence.High,
        status: ItemStatus.Draft,
        overlapFlag: OverlapFlag.None,
      });
    });

    it('does not stream any error events', () => {
      expect(events.some((e) => e.type === 'error')).toBe(false);
    });
  });

  // ── Validation rejection ──────────────────────────────────────────────────

  describe('validation — invalid inputType', () => {
    it('rejects with HTTP 400 for an unrecognised inputType', async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValue('{}');

      const res = (await request(app.getHttpServer())
        .post('/analyse')
        .field('inputType', 'docx') // not in ['text', 'pdf']
        .field('textContent', INPUT_TEXT)
        .buffer(true)) as unknown as { status: number };

      jest.restoreAllMocks();
      expect(res.status).toBe(400);
    });
  });
});
