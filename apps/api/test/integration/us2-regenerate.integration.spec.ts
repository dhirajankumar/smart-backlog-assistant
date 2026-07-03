import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response as SupertestResponse } from 'supertest';
import { firstValueFrom, toArray } from 'rxjs';
import {
  Confidence,
  ExistingBacklogItem,
  ItemStatus,
  OverlapFlag,
  Priority,
  UserStory,
} from '@smart-backlog/shared';
import { RegenerateModule } from '../../src/regenerate/regenerate.module';
import { RegenerateService } from '../../src/regenerate/regenerate.service';
import { AiService } from '../../src/ai/ai.service';
import { RegenerateDto } from '../../src/regenerate/regenerate.dto';

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

/** Drives RegenerateService.stream() directly and collects all SSE events. */
async function streamServiceEvents(
  service: RegenerateService,
  dto: RegenerateDto,
): Promise<SseEvent[]> {
  const raw = await firstValueFrom(service.stream(dto).pipe(toArray()));
  return raw.map((e) => JSON.parse(e.data as string) as SseEvent);
}

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeOriginalStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
    title: 'Upload Requirements Document',
    role: 'product owner',
    benefit: 'get AI-driven analysis of project requirements',
    acceptanceCriteria: [
      'User can paste text or upload a PDF up to 10 MB',
      'Progress indicator updates for each step',
    ],
    priority: Priority.High,
    category: 'Core Workflow',
    confidence: Confidence.Medium,
    rationale: 'Core user need identified in discovery',
    overlapFlag: OverlapFlag.None,
    overlapReference: null,
    status: ItemStatus.Draft,
    originalAiText: null,
    sourceSegment: 0,
    promptVersion: '1.0.0',
    generatedAt: '2026-07-03T00:00:00.000Z',
    ...overrides,
  };
}

const REGEN_STORY_FIXTURE = {
  title: 'Upload Requirements Document (Mobile-first)',
  role: 'mobile user',
  benefit: 'analyse requirements on the go without a desktop browser',
  acceptanceCriteria: [
    'User can upload a PDF from their mobile device',
    'UI adapts to small screen sizes (320 px min-width)',
  ],
  priority: Priority.High,
  category: 'Core Workflow',
  confidence: Confidence.High,
  rationale: 'Reviewer feedback requested mobile-optimised experience',
  sourceSegment: 0,
};

const REGENERATED_STORY_JSON = JSON.stringify(REGEN_STORY_FIXTURE);

const REGENERATED_TASK_JSON = JSON.stringify({
  title: 'Implement PDF upload endpoint (mobile-optimised)',
  description:
    'Add a multipart POST /analyse endpoint that accepts PDF files and streams SSE events to mobile clients.',
  priority: Priority.High,
  category: 'Core Workflow',
  confidence: Confidence.High,
  rationale: 'Implementation task derived from mobile-first story',
});

const FEEDBACK = 'Make the story more focused on mobile users.';

// ═════════════════════════════════════════════════════════════════════════════
// US2 — Service-level integration (real OverlapService, mock AI)
// ═════════════════════════════════════════════════════════════════════════════
//
// Bootstraps the full RegenerateModule with the real OverlapService.
// Only AiService is mocked. These tests verify the integration between
// RegenerateService and OverlapService.

describe('US2 — RegenerateModule integration (service-level)', () => {
  let module: TestingModule;
  let service: RegenerateService;
  let aiService: AiService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [RegenerateModule],
    }).compile();

    service = module.get(RegenerateService);
    aiService = module.get(AiService);
  });

  afterAll(async () => {
    await module.close();
  });

  // ── Happy path: story regeneration with reviewer feedback ─────────────────

  describe('happy path — story regeneration with reviewer feedback', () => {
    let events: SseEvent[];
    let completeSpy: jest.SpyInstance;

    const dto: RegenerateDto = {
      targetType: 'story',
      target: makeOriginalStory(),
      feedback: FEEDBACK,
    };

    beforeAll(async () => {
      completeSpy = jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REGENERATED_STORY_JSON);

      events = await streamServiceEvents(service, dto);
    });

    afterAll(() => {
      completeSpy.mockRestore();
    });

    it('emits progress(regenerating) as the first event', () => {
      expect(events[0]).toEqual({ type: 'progress', step: 'regenerating' });
    });

    it('emits exactly one story event', () => {
      expect(events.filter((e) => e.type === 'story')).toHaveLength(1);
    });

    it('story event contains all required UserStory fields', () => {
      const story = events.find((e) => e.type === 'story')?.payload;
      expect(story).toMatchObject({
        id: expect.any(String),
        title: REGEN_STORY_FIXTURE.title,
        role: REGEN_STORY_FIXTURE.role,
        benefit: REGEN_STORY_FIXTURE.benefit,
        acceptanceCriteria: expect.arrayContaining([
          'User can upload a PDF from their mobile device',
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

    it('regenerated story id is a new UUID (distinct from the original)', () => {
      const id = events.find((e) => e.type === 'story')?.payload?.['id'] as string;
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(id).not.toBe(makeOriginalStory().id);
    });

    it('story event comes before the complete event', () => {
      const storyIdx = events.findIndex((e) => e.type === 'story');
      const completeIdx = events.findIndex((e) => e.type === 'complete');
      expect(storyIdx).toBeLessThan(completeIdx);
    });

    it('emits complete as the last event', () => {
      expect(events[events.length - 1]).toEqual({ type: 'complete' });
    });

    it('does not emit any error event', () => {
      expect(events.some((e) => e.type === 'error')).toBe(false);
    });

    it('calls AiService.complete exactly once', () => {
      expect(completeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Happy path: story regeneration with existing-backlog overlap detection ─

  describe('happy path — existing backlog triggers overlap detection on regenerated story', () => {
    let events: SseEvent[];

    // The existing item title + description mirrors the regenerated story's title + benefit
    // so that tokenized-IoU = 1.0, reliably above the 0.6 threshold.
    const EXISTING_TITLE = REGEN_STORY_FIXTURE.title;
    const existingItems: ExistingBacklogItem[] = [
      {
        title: EXISTING_TITLE,
        description: REGEN_STORY_FIXTURE.benefit, // mirrors story benefit tokens
        priority: 'High',
        category: 'Core Workflow',
      },
    ];

    const dto: RegenerateDto = {
      targetType: 'story',
      target: makeOriginalStory(),
      feedback: FEEDBACK,
      existingBacklogItems: existingItems,
    };

    beforeAll(async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REGENERATED_STORY_JSON);

      events = await streamServiceEvents(service, dto);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('emits an overlap_update event when the regenerated story matches an existing item', () => {
      expect(events.filter((e) => e.type === 'overlap_update')).toHaveLength(1);
    });

    it('overlap_update flag is existing_overlap', () => {
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.flag).toBe(OverlapFlag.ExistingOverlap);
    });

    it('overlap_update reference is the matching existing item title', () => {
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.reference).toBe(EXISTING_TITLE);
    });

    it('overlap_update storyId matches the regenerated story id', () => {
      const storyId = events.find((e) => e.type === 'story')?.payload?.['id'];
      const overlapEvent = events.find((e) => e.type === 'overlap_update');
      expect(overlapEvent?.storyId).toBe(storyId);
    });
  });

  // ── Happy path: task regeneration ────────────────────────────────────────

  describe('happy path — task regeneration with reviewer feedback', () => {
    let events: SseEvent[];

    const originalTask = {
      id: 'task-0001-0002-0003-0004-000500060007',
      storyId: makeOriginalStory().id,
      title: 'Implement PDF upload endpoint',
      description: 'Add the /analyse POST endpoint',
      priority: Priority.Medium,
      category: 'Core Workflow',
      confidence: Confidence.Medium,
      rationale: 'Required for story acceptance criteria',
      overlapFlag: OverlapFlag.None,
      overlapReference: null,
      status: ItemStatus.Draft,
      originalAiText: null,
      promptVersion: '1.0.0',
      generatedAt: '2026-07-03T00:00:00.000Z',
    };

    beforeAll(async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REGENERATED_TASK_JSON);

      events = await streamServiceEvents(service, {
        targetType: 'task',
        target: originalTask,
        feedback: 'Make it explicitly mobile-optimised.',
      } as RegenerateDto);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('emits progress(regenerating) as the first event', () => {
      expect(events[0]).toEqual({ type: 'progress', step: 'regenerating' });
    });

    it('emits a task event (not a story event)', () => {
      expect(events.some((e) => e.type === 'task')).toBe(true);
      expect(events.some((e) => e.type === 'story')).toBe(false);
    });

    it('task event preserves the original storyId', () => {
      const taskEvent = events.find((e) => e.type === 'task');
      expect(taskEvent?.payload?.['storyId']).toBe(originalTask.storyId);
    });

    it('task event title reflects the AI-updated content', () => {
      const taskEvent = events.find((e) => e.type === 'task');
      expect(taskEvent?.payload?.['title']).toBe(
        'Implement PDF upload endpoint (mobile-optimised)',
      );
    });

    it('emits complete as the last event', () => {
      expect(events[events.length - 1]).toEqual({ type: 'complete' });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// US2 — HTTP integration (full NestJS pipeline via supertest, POST /regenerate)
// ═════════════════════════════════════════════════════════════════════════════

describe('US2 — POST /regenerate HTTP integration', () => {
  let app: INestApplication;
  let aiService: AiService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [RegenerateModule],
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

  describe('happy path — story regeneration via HTTP (JSON body)', () => {
    let res: SupertestResponse;
    let events: SseEvent[];

    const requestBody: RegenerateDto = {
      targetType: 'story',
      target: makeOriginalStory(),
      feedback: FEEDBACK,
    };

    beforeAll(async () => {
      jest
        .spyOn(aiService, 'complete')
        .mockResolvedValueOnce(REGENERATED_STORY_JSON);

      res = await request(app.getHttpServer())
        .post('/regenerate')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .buffer(true) as unknown as SupertestResponse;

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

    it('streams progress, story, and complete events', () => {
      const types = events.map((e) => e.type);
      expect(types).toContain('progress');
      expect(types).toContain('story');
      expect(types).toContain('complete');
    });

    it('story payload has a new UUID and the updated title', () => {
      const story = events.find((e) => e.type === 'story')?.payload;
      expect(story).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        title: REGEN_STORY_FIXTURE.title,
        status: ItemStatus.Draft,
      });
    });

    it('does not stream any error events', () => {
      expect(events.some((e) => e.type === 'error')).toBe(false);
    });
  });

  // ── Validation rejection ──────────────────────────────────────────────────

  describe('validation — missing or invalid fields', () => {
    it('returns HTTP 400 when targetType is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/regenerate')
        .send({ targetType: 'invalid', target: makeOriginalStory(), feedback: 'test' })
        .set('Content-Type', 'application/json')
        .buffer(true) as unknown as SupertestResponse;

      expect(res.status).toBe(400);
    });

    it('returns HTTP 400 when feedback is an empty string', async () => {
      const res = await request(app.getHttpServer())
        .post('/regenerate')
        .send({ targetType: 'story', target: makeOriginalStory(), feedback: '' })
        .set('Content-Type', 'application/json')
        .buffer(true) as unknown as SupertestResponse;

      expect(res.status).toBe(400);
    });
  });
});
