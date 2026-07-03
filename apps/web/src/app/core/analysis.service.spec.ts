// Node.js TextEncoder/TextDecoder polyfill needed for jest-environment-jsdom
import { TextDecoder, TextEncoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });


import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AnalysisService } from './analysis.service';
import { SessionService } from './session.service';
import {
  Confidence,
  InputFormat,
  ItemStatus,
  OverlapFlag,
  Priority,
  SessionStatus,
  UserStory,
} from '@smart-backlog/shared';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'story-1',
    title: 'Upload doc',
    role: 'reviewer',
    benefit: 'analyse requirements',
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

/** Build a mock response body that yields encoded chunks then EOF — avoids ReadableStream. */
function makeBodyMock(chunks: string[]): { getReader: () => object } {
  const encoder = new TextEncoder();
  let idx = 0;
  return {
    getReader() {
      return {
        read() {
          if (idx < chunks.length) {
            return Promise.resolve({ done: false, value: encoder.encode(chunks[idx++]) });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
        releaseLock() { /* noop */ },
      };
    },
  };
}

function sseChunk(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// ── mock SessionService ───────────────────────────────────────────────────────

function makeMockSession() {
  return {
    status$: new BehaviorSubject(SessionStatus.Idle),
    startAnalysis: jest.fn(),
    setRequirementsSummary: jest.fn(),
    appendStory: jest.fn(),
    patchStoryOverlap: jest.fn(),
    setAnalysisComplete: jest.fn(),
    setAnalysisError: jest.fn(),
    replaceStory: jest.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AnalysisService', () => {
  let service: AnalysisService;
  let mockSession: ReturnType<typeof makeMockSession>;

  beforeEach(() => {
    mockSession = makeMockSession();
    TestBed.configureTestingModule({
      providers: [
        AnalysisService,
        { provide: SessionService, useValue: mockSession },
      ],
    });
    service = TestBed.inject(AnalysisService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is defined', () => {
    expect(service).toBeTruthy();
  });

  describe('startAnalysis()', () => {
    it('calls session.startAnalysis with an InputDocument built from FormData (text mode)', async () => {
      const formData = new FormData();
      formData.append('inputType', 'text');
      formData.append('textContent', 'hello world requirements');

      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: makeBodyMock([sseChunk({ type: 'progress', step: 'complete' })]),
      } as unknown as Response);
      globalThis.fetch = fetchMock;

      service.startAnalysis(formData);
      await new Promise(r => setTimeout(r, 50));

      expect(mockSession.startAnalysis).toHaveBeenCalledTimes(1);
      const [inputDoc] = mockSession.startAnalysis.mock.calls[0] as [{ format: InputFormat; wordCount: number }];
      expect(inputDoc.format).toBe(InputFormat.Text);
      expect(inputDoc.wordCount).toBe(3);
    });

    it('sets format=PDF for pdf inputType', async () => {
      const formData = new FormData();
      formData.append('inputType', 'pdf');
      formData.append('pdfFile', new File(['bytes'], 'spec.pdf'));

      globalThis.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: makeBodyMock([sseChunk({ type: 'progress', step: 'complete' })]),
      } as unknown as Response);

      service.startAnalysis(formData);
      await new Promise(r => setTimeout(r, 50));

      const [inputDoc] = mockSession.startAnalysis.mock.calls[0] as [{ format: InputFormat; filename: string | null }];
      expect(inputDoc.format).toBe(InputFormat.PDF);
      expect(inputDoc.filename).toBe('spec.pdf');
    });
  });

  describe('SSE event dispatch', () => {
    async function runWithEvents(events: object[]): Promise<void> {
      const chunks = events.map(e => sseChunk(e));
      globalThis.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: makeBodyMock(chunks),
      } as unknown as Response);

      const fd = new FormData();
      fd.append('inputType', 'text');
      fd.append('textContent', 'requirements');
      service.startAnalysis(fd);
      await new Promise(r => setTimeout(r, 50));
    }

    it('dispatches summary events to session.setRequirementsSummary', async () => {
      const summary = { bullets: ['r1'], reviewerNote: null, generatedAt: 'ts', promptVersion: '1.0.0' };
      await runWithEvents([{ type: 'summary', payload: summary }]);
      expect(mockSession.setRequirementsSummary).toHaveBeenCalledWith(summary);
    });

    it('dispatches story events to session.appendStory', async () => {
      const story = makeStory();
      await runWithEvents([{ type: 'story', payload: story }]);
      expect(mockSession.appendStory).toHaveBeenCalledWith(story);
    });

    it('dispatches overlap_update events to session.patchStoryOverlap', async () => {
      await runWithEvents([{ type: 'overlap_update', storyId: 's1', flag: OverlapFlag.ExistingOverlap, reference: 'Old item' }]);
      expect(mockSession.patchStoryOverlap).toHaveBeenCalledWith('s1', OverlapFlag.ExistingOverlap, 'Old item');
    });

    it('calls session.setAnalysisComplete on progress step=complete', async () => {
      await runWithEvents([{ type: 'progress', step: 'complete' }]);
      expect(mockSession.setAnalysisComplete).toHaveBeenCalled();
    });

    it('dispatches error events to session.setAnalysisError', async () => {
      const payload = { code: 'AI_TIMEOUT', message: 'timed out' };
      await runWithEvents([{ type: 'error', payload }]);
      expect(mockSession.setAnalysisError).toHaveBeenCalledWith(payload);
    });

    it('updates currentStep$ on progress events', async () => {
      await runWithEvents([{ type: 'progress', step: 'generating_stories' }]);
      expect(service.currentStep$.getValue()).toBe('generating_stories');
    });
  });

  describe('network failure', () => {
    it('calls session.setAnalysisError when fetch rejects', async () => {
      globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('network down'));

      const fd = new FormData();
      fd.append('inputType', 'text');
      fd.append('textContent', 'reqs');
      service.startAnalysis(fd);
      await new Promise(r => setTimeout(r, 50));

      expect(mockSession.setAnalysisError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NETWORK_ERROR' })
      );
    });

    it('calls session.setAnalysisError on non-ok HTTP status', async () => {
      globalThis.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500, body: null } as unknown as Response);

      const fd = new FormData();
      fd.append('inputType', 'text');
      fd.append('textContent', 'reqs');
      service.startAnalysis(fd);
      await new Promise(r => setTimeout(r, 50));

      expect(mockSession.setAnalysisError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'HTTP_ERROR' })
      );
    });
  });
});
