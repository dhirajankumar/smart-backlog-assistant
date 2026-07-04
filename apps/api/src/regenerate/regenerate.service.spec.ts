import { Test, TestingModule } from '@nestjs/testing';
import { lastValueFrom, toArray } from 'rxjs';

import { Confidence, ItemStatus, OverlapFlag, Priority, Task, UserStory } from '@smart-backlog/shared';

import { AiService } from '../ai/ai.service';
import { OverlapService } from '../overlap/overlap.service';
import { RegenerateDto } from './regenerate.dto';
import { RegenerateService } from './regenerate.service';

function makeStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'story-1',
    title: 'Original story',
    role: 'admin',
    benefit: 'manage users',
    acceptanceCriteria: ['AC1', 'AC2'],
    priority: Priority.Medium,
    category: 'Core Workflow',
    confidence: Confidence.Medium,
    rationale: 'Original rationale',
    overlapFlag: OverlapFlag.None,
    overlapReference: null,
    status: ItemStatus.Draft,
    originalAiText: null,
    sourceSegment: 0,
    promptVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    storyId: 'story-1',
    title: 'Original task',
    description: 'Do something',
    priority: Priority.Medium,
    category: 'Core Workflow',
    confidence: Confidence.Medium,
    rationale: 'Original rationale',
    overlapFlag: OverlapFlag.None,
    overlapReference: null,
    status: ItemStatus.Draft,
    originalAiText: null,
    promptVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function collectEvents(service: RegenerateService, dto: RegenerateDto) {
  return lastValueFrom(
    service.stream(dto).pipe(toArray()),
  ).then((events) => events.map((e) => JSON.parse(e.data as string) as Record<string, unknown>));
}

describe('RegenerateService', () => {
  let service: RegenerateService;
  let aiService: jest.Mocked<AiService>;
  let overlapService: jest.Mocked<OverlapService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegenerateService,
        {
          provide: AiService,
          useValue: { complete: jest.fn() },
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

    service = module.get(RegenerateService);
    aiService = module.get(AiService);
    overlapService = module.get(OverlapService);
  });

  describe('story regeneration', () => {
    const storyPayload = {
      title: 'Refined story',
      role: 'editor',
      benefit: 'publish content easily',
      acceptanceCriteria: ['Can edit', 'Can save'],
      priority: 'High',
      category: 'Core Workflow',
      confidence: 'High',
      rationale: 'Refined rationale',
      sourceSegment: 0,
    };

    it('emits progress → story → complete in order', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(storyPayload));

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Make it more specific',
      };

      const events = await collectEvents(service, dto);

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'progress', step: 'regenerating' });
      expect(events[1]['type']).toBe('story');
      expect(events[2]).toEqual({ type: 'complete' });
    });

    it('maps AI response fields onto a new UserStory with Draft status', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(storyPayload));

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'More detail please',
      };

      const events = await collectEvents(service, dto);
      const payload = (events[1] as { type: string; payload: UserStory })['payload'];

      expect(payload.title).toBe('Refined story');
      expect(payload.role).toBe('editor');
      expect(payload.priority).toBe(Priority.High);
      expect(payload.confidence).toBe(Confidence.High);
      expect(payload.status).toBe(ItemStatus.Draft);
      expect(payload.overlapFlag).toBe(OverlapFlag.None);
      expect(payload.id).toBeDefined();
      expect(payload.id).not.toBe('story-1');
      expect(payload.promptVersion).toBe('1.0.0');
    });

    it('emits overlap_update when an existing item overlaps the regenerated story', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(storyPayload));
      overlapService.detectExistingOverlaps.mockImplementation((stories) => {
        stories[0].overlapFlag = OverlapFlag.ExistingOverlap;
        stories[0].overlapReference = 'Matching item';
        return stories;
      });

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Refine',
        existingBacklogItems: [{ title: 'Matching item' }],
      };

      const events = await collectEvents(service, dto);

      expect(events).toHaveLength(4);
      expect(events[2]['type']).toBe('overlap_update');
      expect(events[2]['flag']).toBe(OverlapFlag.ExistingOverlap);
      expect(events[2]['reference']).toBe('Matching item');
      expect(events[3]).toEqual({ type: 'complete' });
    });

    it('skips overlap detection when existingBacklogItems is absent', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(storyPayload));

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Refine',
      };

      await collectEvents(service, dto);

      expect(overlapService.detectExistingOverlaps).not.toHaveBeenCalled();
    });

    it('emits AI_TIMEOUT error when the AI call is aborted', async () => {
      const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
      aiService.complete.mockRejectedValue(abortErr);

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Improve',
      };

      const events = await collectEvents(service, dto);

      expect(events[0]).toEqual({ type: 'progress', step: 'regenerating' });
      expect(events[1]).toEqual({
        type: 'error',
        payload: { code: 'AI_TIMEOUT', message: 'AI request timed out after 58 seconds' },
      });
      expect(events).toHaveLength(2);
    });

    it('emits AI_MALFORMED_RESPONSE error when AI returns invalid JSON', async () => {
      aiService.complete.mockResolvedValue('{{not json}}');

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Improve',
      };

      const events = await collectEvents(service, dto);

      expect(events[1]['type']).toBe('error');
      expect((events[1] as { payload: { code: string } })['payload']['code']).toBe('AI_MALFORMED_RESPONSE');
    });

    it('emits AI_MALFORMED_RESPONSE error when the AI service throws a generic error', async () => {
      aiService.complete.mockRejectedValue(new Error('Network failure'));

      const dto: RegenerateDto = {
        targetType: 'story',
        target: makeStory(),
        feedback: 'Improve',
      };

      const events = await collectEvents(service, dto);

      expect(events[1]).toEqual({
        type: 'error',
        payload: { code: 'AI_MALFORMED_RESPONSE', message: 'Network failure' },
      });
    });
  });

  describe('task regeneration', () => {
    const taskPayload = {
      title: 'Refined task',
      description: 'Implement the refined feature',
      priority: 'High',
      category: 'Core Workflow',
      confidence: 'High',
      rationale: 'Needed for compliance',
    };

    it('emits progress → task → complete in order', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(taskPayload));

      const dto: RegenerateDto = {
        targetType: 'task',
        target: makeTask(),
        feedback: 'More detail',
        parentStory: makeStory(),
      };

      const events = await collectEvents(service, dto);

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'progress', step: 'regenerating' });
      expect(events[1]['type']).toBe('task');
      expect(events[2]).toEqual({ type: 'complete' });
    });

    it('maps AI response onto a new Task preserving storyId from the original', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(taskPayload));

      const dto: RegenerateDto = {
        targetType: 'task',
        target: makeTask({ storyId: 'story-99' }),
        feedback: 'Be specific',
      };

      const events = await collectEvents(service, dto);
      const payload = (events[1] as { type: string; payload: Task })['payload'];

      expect(payload.storyId).toBe('story-99');
      expect(payload.title).toBe('Refined task');
      expect(payload.description).toBe('Implement the refined feature');
      expect(payload.priority).toBe(Priority.High);
      expect(payload.status).toBe(ItemStatus.Draft);
      expect(payload.id).not.toBe('task-1');
    });

    it('does not run overlap detection for tasks even when existingBacklogItems is provided', async () => {
      aiService.complete.mockResolvedValue(JSON.stringify(taskPayload));

      const dto: RegenerateDto = {
        targetType: 'task',
        target: makeTask(),
        feedback: 'Refine',
        existingBacklogItems: [{ title: 'Some existing item' }],
      };

      await collectEvents(service, dto);

      expect(overlapService.detectExistingOverlaps).not.toHaveBeenCalled();
    });
  });
});
