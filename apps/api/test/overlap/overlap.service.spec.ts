import { Test, TestingModule } from '@nestjs/testing';
import { Confidence, ItemStatus, OverlapFlag, Priority, UserStory, ExistingBacklogItem } from '@smart-backlog/shared';
import { OverlapService } from '../../src/overlap/overlap.service';

function makeStory(overrides: Partial<UserStory> & { title: string; benefit: string }): UserStory {
  return {
    id: overrides.id ?? 'story-id',
    title: overrides.title,
    role: 'product owner',
    benefit: overrides.benefit,
    acceptanceCriteria: ['AC1', 'AC2'],
    priority: Priority.Medium,
    category: 'Core Workflow',
    confidence: Confidence.High,
    rationale: 'rationale',
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

describe('OverlapService', () => {
  let service: OverlapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OverlapService],
    }).compile();
    service = module.get<OverlapService>(OverlapService);
  });

  // ── detectSessionDuplicates ───────────────────────────────────────────────

  describe('detectSessionDuplicates', () => {
    it('returns empty array unchanged', () => {
      expect(service.detectSessionDuplicates([])).toEqual([]);
    });

    it('returns a single story with no flags set', () => {
      const story = makeStory({ id: 's1', title: 'Upload document', benefit: 'analyse requirements' });
      const result = service.detectSessionDuplicates([story]);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
    });

    it('does not flag two clearly dissimilar stories', () => {
      const s1 = makeStory({ id: 's1', title: 'Upload document', benefit: 'analyse requirements' });
      const s2 = makeStory({ id: 's2', title: 'Export JSON report', benefit: 'download results' });
      const result = service.detectSessionDuplicates([s1, s2]);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
      expect(result[1].overlapFlag).toBe(OverlapFlag.None);
    });

    it('flags the second story as session_duplicate when it is near-identical to the first', () => {
      const text = 'upload document analyse requirements backlog review';
      const s1 = makeStory({ id: 's1', title: text, benefit: text });
      const s2 = makeStory({ id: 's2', title: text, benefit: text });
      const result = service.detectSessionDuplicates([s1, s2]);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
      expect(result[1].overlapFlag).toBe(OverlapFlag.SessionDuplicate);
    });

    it('sets overlapReference on the duplicate to the first story title', () => {
      const shared = 'upload document analyse requirements backlog review';
      const s1 = makeStory({ id: 's1', title: 'Upload document for analysis', benefit: shared });
      const s2 = makeStory({ id: 's2', title: 'Upload document for analysis', benefit: shared });
      const result = service.detectSessionDuplicates([s1, s2]);
      expect(result[1].overlapReference).toBe(s1.title);
    });

    it('does not flag stories whose IoU is below 0.6', () => {
      const s1 = makeStory({ id: 's1', title: 'alpha beta gamma delta epsilon', benefit: 'do something' });
      const s2 = makeStory({ id: 's2', title: 'zeta eta theta iota kappa', benefit: 'do other thing' });
      const result = service.detectSessionDuplicates([s1, s2]);
      expect(result[1].overlapFlag).toBe(OverlapFlag.None);
    });

    it('keeps first occurrence unflagged when three stories share the same text', () => {
      const text = 'review backlog stories user acceptance criteria approval';
      const stories = [
        makeStory({ id: 's1', title: text, benefit: text }),
        makeStory({ id: 's2', title: text, benefit: text }),
        makeStory({ id: 's3', title: text, benefit: text }),
      ];
      const result = service.detectSessionDuplicates(stories);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
      expect(result[1].overlapFlag).toBe(OverlapFlag.SessionDuplicate);
      expect(result[2].overlapFlag).toBe(OverlapFlag.SessionDuplicate);
    });
  });

  // ── detectExistingOverlaps ────────────────────────────────────────────────

  describe('detectExistingOverlaps', () => {
    it('returns stories unchanged when existing list is empty', () => {
      const story = makeStory({ id: 's1', title: 'Upload document', benefit: 'analyse requirements' });
      const result = service.detectExistingOverlaps([story], []);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
    });

    it('does not flag a story with no similar existing items', () => {
      const story = makeStory({ id: 's1', title: 'Export JSON report', benefit: 'download audit results' });
      const existing: ExistingBacklogItem[] = [{ title: 'Authenticate users', description: 'login logout session' }];
      const result = service.detectExistingOverlaps([story], existing);
      expect(result[0].overlapFlag).toBe(OverlapFlag.None);
    });

    it('flags story as existing_overlap when it matches an existing backlog item', () => {
      const text = 'upload document analyse requirements backlog review';
      const story = makeStory({ id: 's1', title: text, benefit: text });
      const existing: ExistingBacklogItem[] = [{ title: text, description: text }];
      const result = service.detectExistingOverlaps([story], existing);
      expect(result[0].overlapFlag).toBe(OverlapFlag.ExistingOverlap);
    });

    it('sets overlapReference to the matching existing item title', () => {
      const text = 'upload document analyse requirements backlog review';
      const story = makeStory({ id: 's1', title: text, benefit: text });
      const existing: ExistingBacklogItem[] = [{ title: 'Original upload feature', description: text }];
      const result = service.detectExistingOverlaps([story], existing);
      expect(result[0].overlapReference).toBe('Original upload feature');
    });

    it('existing_overlap overrides a prior session_duplicate flag', () => {
      const text = 'upload document analyse requirements backlog review';
      const story = makeStory({
        id: 's1',
        title: text,
        benefit: text,
        overlapFlag: OverlapFlag.SessionDuplicate,
        overlapReference: 'Some other story',
      });
      const existing: ExistingBacklogItem[] = [{ title: text, description: text }];
      const result = service.detectExistingOverlaps([story], existing);
      expect(result[0].overlapFlag).toBe(OverlapFlag.ExistingOverlap);
    });

    it('processes all stories, flagging each one that matches', () => {
      const text = 'upload document analyse requirements backlog review';
      const stories = [
        makeStory({ id: 's1', title: text, benefit: text }),
        makeStory({ id: 's2', title: 'completely different thing', benefit: 'no overlap here' }),
      ];
      const existing: ExistingBacklogItem[] = [{ title: text, description: text }];
      const result = service.detectExistingOverlaps(stories, existing);
      expect(result[0].overlapFlag).toBe(OverlapFlag.ExistingOverlap);
      expect(result[1].overlapFlag).toBe(OverlapFlag.None);
    });
  });
});
