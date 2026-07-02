import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AnalyseDto, AnalyseTasksDto } from '../../src/analyse/analyse.dto';

// Minimal valid UserStory shape for DTO tests
const validStory = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'As a reviewer I want to submit input',
  role: 'reviewer',
  benefit: 'analyse requirements faster',
  acceptanceCriteria: ['criterion A', 'criterion B'],
  priority: 'High',
  category: 'Core Workflow',
  confidence: 'High',
  rationale: 'Inferred from document overview',
  overlapFlag: 'none',
  overlapReference: null,
  status: 'Draft',
  originalAiText: null,
  sourceSegment: 0,
  promptVersion: '1.0.0',
  generatedAt: '2026-07-02T00:00:00.000Z',
};

// ── AnalyseDto ────────────────────────────────────────────────────────────────

describe('AnalyseDto', () => {
  it('passes with inputType "text"', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'text' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with inputType "pdf"', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'pdf' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with inputType "text" and a textContent string', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'text', textContent: 'hello world' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes when textContent is absent', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'pdf' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when inputType is an unsupported value', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'docx' });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'inputType');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints!)).toContain('isIn');
  });

  it('fails when inputType is missing', async () => {
    const dto = plainToInstance(AnalyseDto, {});
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'inputType');
    expect(field).toBeDefined();
  });

  it('fails when textContent is not a string', async () => {
    const dto = plainToInstance(AnalyseDto, { inputType: 'text', textContent: 42 });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'textContent');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints!)).toContain('isString');
  });
});

// ── AnalyseTasksDto ───────────────────────────────────────────────────────────

describe('AnalyseTasksDto', () => {
  it('passes with a valid story and no existingBacklogItems', async () => {
    const dto = plainToInstance(AnalyseTasksDto, { story: validStory });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid story and an empty existingBacklogItems array', async () => {
    const dto = plainToInstance(AnalyseTasksDto, { story: validStory, existingBacklogItems: [] });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid existingBacklogItems containing title only', async () => {
    const dto = plainToInstance(AnalyseTasksDto, {
      story: validStory,
      existingBacklogItems: [{ title: 'Existing story A' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with full existingBacklogItem shape', async () => {
    const dto = plainToInstance(AnalyseTasksDto, {
      story: validStory,
      existingBacklogItems: [
        { title: 'Existing story A', description: 'desc', priority: 'High', category: 'Core Workflow' },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when story is missing', async () => {
    const dto = plainToInstance(AnalyseTasksDto, { existingBacklogItems: [] });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'story');
    expect(field).toBeDefined();
  });

  it('fails when story is not an object (e.g. a string)', async () => {
    const dto = plainToInstance(AnalyseTasksDto, { story: 'not-an-object' });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'story');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints!)).toContain('isObject');
  });

  it('fails when existingBacklogItems contains an item without title', async () => {
    const dto = plainToInstance(AnalyseTasksDto, {
      story: validStory,
      existingBacklogItems: [{ description: 'no title here' }],
    });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'existingBacklogItems');
    expect(field).toBeDefined();
    expect(field!.children?.length).toBeGreaterThan(0);
  });

  it('fails when existingBacklogItems is not an array', async () => {
    const dto = plainToInstance(AnalyseTasksDto, { story: validStory, existingBacklogItems: 'bad' });
    const errors = await validate(dto);
    const field = errors.find((e) => e.property === 'existingBacklogItems');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints!)).toContain('isArray');
  });
});
