import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of, toArray } from 'rxjs';
import {
  Confidence,
  ItemStatus,
  OverlapFlag,
  Priority,
  Task,
  UserStory,
} from '@smart-backlog/shared';
import { AnalyseController } from '../../src/analyse/analyse.controller';
import { AnalyseService } from '../../src/analyse/analyse.service';
import { AnalyseDto, AnalyseTasksDto } from '../../src/analyse/analyse.dto';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMulierFile(buffer: Buffer, fieldname: string): Express.Multer.File {
  return {
    fieldname,
    originalname: `${fieldname}.bin`,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    buffer,
    size: buffer.byteLength,
  } as Express.Multer.File;
}

function makeStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'story-uuid',
    title: 'Upload doc',
    role: 'product owner',
    benefit: 'analyse requirements',
    acceptanceCriteria: ['AC1', 'AC2'],
    priority: Priority.Medium,
    category: 'Core Workflow',
    confidence: Confidence.High,
    rationale: 'rationale',
    overlapFlag: OverlapFlag.None,
    overlapReference: null,
    status: ItemStatus.Approved,
    originalAiText: null,
    sourceSegment: 0,
    promptVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const TEXT_DTO: AnalyseDto = { inputType: 'text', textContent: 'Project requirements' };

const TASK_DTO: AnalyseTasksDto = { story: makeStory() };

// ── tests ────────────────────────────────────────────────────────────────────

describe('AnalyseController', () => {
  let controller: AnalyseController;
  let analyseService: jest.Mocked<AnalyseService>;

  const sseEvent = { data: '{"type":"progress","step":"complete"}' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyseController],
      providers: [
        {
          provide: AnalyseService,
          useValue: {
            stream: jest.fn().mockReturnValue(of(sseEvent)),
            generateTasks: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get(AnalyseController);
    analyseService = module.get(AnalyseService) as jest.Mocked<AnalyseService>;
  });

  // ── SSE stream endpoint ───────────────────────────────────────────────────

  describe('stream()', () => {
    it('returns the Observable from analyseService.stream()', async () => {
      const result = controller.stream(TEXT_DTO, {});
      const events = await firstValueFrom(result.pipe(toArray()));
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(sseEvent);
    });

    it('calls analyseService.stream() with the DTO and undefined buffers when no files', () => {
      controller.stream(TEXT_DTO, {});
      expect(analyseService.stream).toHaveBeenCalledWith(TEXT_DTO, undefined, undefined);
    });

    it('passes pdfBuffer extracted from files.pdfFile[0].buffer', () => {
      const pdfBuffer = Buffer.from('pdf-bytes');
      controller.stream(TEXT_DTO, { pdfFile: [makeMulierFile(pdfBuffer, 'pdfFile')] });
      expect(analyseService.stream).toHaveBeenCalledWith(TEXT_DTO, pdfBuffer, undefined);
    });

    it('passes backlogBuffer extracted from files.backlogJson[0].buffer', () => {
      const backlogBuffer = Buffer.from('[{"title":"existing"}]');
      controller.stream(TEXT_DTO, { backlogJson: [makeMulierFile(backlogBuffer, 'backlogJson')] });
      expect(analyseService.stream).toHaveBeenCalledWith(TEXT_DTO, undefined, backlogBuffer);
    });

    it('passes both buffers when both files are provided', () => {
      const pdfBuffer = Buffer.from('pdf');
      const backlogBuffer = Buffer.from('[{"title":"x"}]');
      controller.stream(TEXT_DTO, {
        pdfFile: [makeMulierFile(pdfBuffer, 'pdfFile')],
        backlogJson: [makeMulierFile(backlogBuffer, 'backlogJson')],
      });
      expect(analyseService.stream).toHaveBeenCalledWith(TEXT_DTO, pdfBuffer, backlogBuffer);
    });

    it('handles undefined files argument gracefully', () => {
      controller.stream(TEXT_DTO, undefined as unknown as Record<string, Express.Multer.File[]>);
      expect(analyseService.stream).toHaveBeenCalledWith(TEXT_DTO, undefined, undefined);
    });
  });

  // ── POST /analyse/tasks endpoint ──────────────────────────────────────────

  describe('tasks()', () => {
    it('calls analyseService.generateTasks() with the DTO', async () => {
      await controller.tasks(TASK_DTO);
      expect(analyseService.generateTasks).toHaveBeenCalledWith(TASK_DTO);
    });

    it('returns the Task[] result from analyseService.generateTasks()', async () => {
      const mockTask: Task = {
        id: 'task-uuid',
        storyId: 'story-uuid',
        title: 'Implement login',
        description: 'Add login endpoint',
        priority: Priority.High,
        category: 'Core Workflow',
        confidence: Confidence.High,
        rationale: 'Core requirement',
        overlapFlag: OverlapFlag.None,
        overlapReference: null,
        status: ItemStatus.Draft,
        originalAiText: null,
        promptVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
      };
      analyseService.generateTasks.mockResolvedValueOnce([mockTask]);

      const result = await controller.tasks(TASK_DTO);
      expect(result).toEqual([mockTask]);
    });

    it('returns an empty array when generateTasks returns no tasks', async () => {
      const result = await controller.tasks(TASK_DTO);
      expect(result).toEqual([]);
    });
  });

  // ── module wiring ─────────────────────────────────────────────────────────

  describe('controller instantiation', () => {
    it('is defined', () => {
      expect(controller).toBeDefined();
    });
  });
});
