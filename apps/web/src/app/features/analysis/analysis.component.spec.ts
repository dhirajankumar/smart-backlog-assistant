import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import {
  Confidence,
  ItemStatus,
  KeyRequirementsSummary,
  OverlapFlag,
  Priority,
  SessionStatus,
  UserStory,
} from '@smart-backlog/shared';
import { AnalysisComponent, PROGRESS_STEPS } from './analysis.component';
import { AnalysisService } from '../../core/analysis.service';
import { SessionService } from '../../core/session.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeStory(overrides: Partial<UserStory> = {}): UserStory {
  return {
    id: 'story-1',
    title: 'Upload document',
    role: 'reviewer',
    benefit: 'analyse requirements',
    acceptanceCriteria: ['AC1', 'AC2'],
    priority: Priority.High,
    category: 'Core Workflow',
    confidence: Confidence.High,
    rationale: 'key requirement',
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

function makeSummary(): KeyRequirementsSummary {
  return { bullets: ['Requirement A', 'Requirement B'], reviewerNote: null, generatedAt: 'ts', promptVersion: '1.0.0' };
}

// ── mock factories ─────────────────────────────────────────────────────────────

function makeSessionMock(status: SessionStatus = SessionStatus.Analysing) {
  return {
    status$: new BehaviorSubject(status),
    stories$: new BehaviorSubject<UserStory[]>([]),
    requirementsSummary$: new BehaviorSubject<KeyRequirementsSummary | null>(null),
    analysisError$: new BehaviorSubject<{ code: string; message: string } | null>(null),
  };
}

function makeAnalysisMock() {
  return { currentStep$: new BehaviorSubject<string | null>(null) };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('AnalysisComponent', () => {
  let fixture: ComponentFixture<AnalysisComponent>;
  let component: AnalysisComponent;
  let sessionMock: ReturnType<typeof makeSessionMock>;
  let analysisMock: ReturnType<typeof makeAnalysisMock>;

  async function setup(status: SessionStatus = SessionStatus.Analysing) {
    sessionMock = makeSessionMock(status);
    analysisMock = makeAnalysisMock();

    await TestBed.configureTestingModule({
      imports: [AnalysisComponent, RouterTestingModule],
      providers: [
        { provide: SessionService, useValue: sessionMock },
        { provide: AnalysisService, useValue: analysisMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('PROGRESS_STEPS', () => {
    it('exports 6 steps in the expected order', () => {
      expect(PROGRESS_STEPS).toHaveLength(6);
      expect(PROGRESS_STEPS[0].id).toBe('extracting_text');
      expect(PROGRESS_STEPS[5].id).toBe('complete');
    });
  });

  describe('progress indicator', () => {
    beforeEach(() => setup(SessionStatus.Analysing));

    it('renders a list item for each step', () => {
      const items = fixture.nativeElement.querySelectorAll('.step-list li');
      expect(items).toHaveLength(PROGRESS_STEPS.length);
    });

    it('marks a step as completed once currentStep$ emits that step', () => {
      analysisMock.currentStep$.next('extracting_text');
      fixture.detectChanges();
      expect(component.isCompleted('extracting_text')).toBe(true);
    });

    it('marks all steps up to and including the current step as completed', () => {
      analysisMock.currentStep$.next('generating_stories');
      fixture.detectChanges();
      const completedIdx = PROGRESS_STEPS.findIndex(s => s.id === 'generating_stories');
      for (let i = 0; i <= completedIdx; i++) {
        expect(component.isCompleted(PROGRESS_STEPS[i].id)).toBe(true);
      }
      expect(component.isCompleted('detecting_overlaps')).toBe(false);
    });

    it('isActive returns true only for the current step', () => {
      analysisMock.currentStep$.next('validating_backlog');
      expect(component.isActive('validating_backlog')).toBe(true);
      expect(component.isActive('extracting_text')).toBe(false);
    });
  });

  describe('error state', () => {
    beforeEach(() => setup(SessionStatus.Error));

    it('shows the error section when status is Error', () => {
      sessionMock.analysisError$.next({ code: 'AI_TIMEOUT', message: 'Request timed out' });
      fixture.detectChanges();
      const errorSection = fixture.nativeElement.querySelector('.error-section');
      expect(errorSection).toBeTruthy();
    });

    it('shows retry button on AI_TIMEOUT error', () => {
      sessionMock.analysisError$.next({ code: 'AI_TIMEOUT', message: 'timed out' });
      fixture.detectChanges();
      const retryBtn = fixture.nativeElement.querySelector('.retry-btn');
      expect(retryBtn).toBeTruthy();
    });
  });

  describe('requirements summary', () => {
    beforeEach(() => setup(SessionStatus.Analysing));

    it('renders summary bullets when requirementsSummary$ emits', () => {
      sessionMock.requirementsSummary$.next(makeSummary());
      fixture.detectChanges();
      const summarySection = fixture.nativeElement.querySelector('.summary-section');
      expect(summarySection).toBeTruthy();
      const bullets = summarySection.querySelectorAll('li');
      expect(bullets).toHaveLength(2);
    });
  });

  describe('story cards', () => {
    beforeEach(() => setup(SessionStatus.Analysing));

    it('renders a story card for each story in stories$', () => {
      sessionMock.stories$.next([makeStory(), makeStory({ id: 'story-2', title: 'Second story' })]);
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('.story-card');
      expect(cards).toHaveLength(2);
    });

    it('displays the story title', () => {
      sessionMock.stories$.next([makeStory({ title: 'Create account flow' })]);
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.story-card h4');
      expect(card.textContent).toContain('Create account flow');
    });
  });

  describe('empty stories at complete', () => {
    it('shows empty message when status is Review with no stories', async () => {
      await setup(SessionStatus.Review);
      sessionMock.stories$.next([]);
      fixture.detectChanges();
      const emptyMsg = fixture.nativeElement.querySelector('.empty-message');
      expect(emptyMsg).toBeTruthy();
    });
  });

  describe('retry()', () => {
    it('navigates to /input', async () => {
      await setup(SessionStatus.Error);
      const { Router } = await import('@angular/router');
      const router = TestBed.inject(Router);
      const spy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.retry();
      expect(spy).toHaveBeenCalledWith(['/input']);
    });
  });
});
