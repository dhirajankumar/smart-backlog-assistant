import { Component, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe, LowerCasePipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { SessionStatus, UserStory } from '@smart-backlog/shared';
import { AnalysisService } from '../../core/analysis.service';
import { SessionService } from '../../core/session.service';

export const PROGRESS_STEPS = [
  { id: 'extracting_text',        label: 'Extracting text' },
  { id: 'validating_backlog',     label: 'Validating backlog' },
  { id: 'analysing_requirements', label: 'Analysing requirements' },
  { id: 'generating_stories',     label: 'Generating stories' },
  { id: 'detecting_overlaps',     label: 'Detecting overlaps' },
  { id: 'complete',               label: 'Complete' },
];

@Component({
  standalone: true,
  selector: 'app-analysis',
  imports: [AsyncPipe, LowerCasePipe, NgClass],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.scss',
})
export class AnalysisComponent implements OnInit, OnDestroy {
  readonly steps = PROGRESS_STEPS;
  readonly status$ = this.session.status$;
  readonly stories$ = this.session.stories$;
  readonly requirementsSummary$ = this.session.requirementsSummary$;
  readonly analysisError$ = this.session.analysisError$;
  readonly currentStep$ = this.analysisService.currentStep$;

  readonly SessionStatus = SessionStatus;

  completedStepIds = new Set<string>();

  private sub = new Subscription();

  constructor(
    private readonly session: SessionService,
    private readonly analysisService: AnalysisService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    // Track completed steps from the SSE progress stream
    this.sub.add(
      this.analysisService.currentStep$.subscribe(step => {
        if (!step) return;
        const idx = this.steps.findIndex(s => s.id === step);
        for (let i = 0; i <= idx; i++) {
          this.completedStepIds.add(this.steps[i].id);
        }
      })
    );

    // Auto-navigate to /review when analysis completes
    this.sub.add(
      this.session.status$.subscribe(status => {
        if (status === SessionStatus.Review) {
          void this.router.navigate(['/review']);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  isCompleted(stepId: string): boolean {
    return this.completedStepIds.has(stepId);
  }

  isActive(stepId: string): boolean {
    return this.analysisService.currentStep$.getValue() === stepId;
  }

  trackStory(_: number, story: UserStory): string {
    return story.id;
  }

  retry(): void {
    void this.router.navigate(['/input']);
  }
}
