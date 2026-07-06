import { Component, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { KeyRequirementsSummary, UserStory } from '@smart-backlog/shared';
import { SessionService } from '../../core/session.service';
import { AnalysisService } from '../../core/analysis.service';
import {
  AmendPayload,
  FeedbackPayload,
  RejectPayload,
  StoryCardComponent,
} from './story-card/story-card.component';

@Component({
  standalone: true,
  selector: 'app-review',
  imports: [
    AsyncPipe, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    StoryCardComponent,
  ],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
})
export class ReviewComponent implements OnInit, OnDestroy {
  readonly stories$ = this.session.stories$;
  readonly reviewSummary$ = this.session.reviewSummary$;
  readonly requirementsSummary$ = this.session.requirementsSummary$;
  readonly canPublish$ = this.session.canPublish$;

  reviewerNote = '';
  private currentSummary: KeyRequirementsSummary | null = null;
  private sub = new Subscription();

  constructor(
    private readonly session: SessionService,
    private readonly analysisService: AnalysisService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.requirementsSummary$.subscribe(summary => {
        this.currentSummary = summary;
        if (summary?.reviewerNote != null) {
          this.reviewerNote = summary.reviewerNote;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onReviewerNoteBlur(): void {
    if (!this.currentSummary) return;
    this.session.setRequirementsSummary({
      ...this.currentSummary,
      reviewerNote: this.reviewerNote.trim() || null,
    });
  }

  onApprove(storyId: string): void {
    this.session.approveStory(storyId);
  }

  onReject(payload: RejectPayload): void {
    this.session.rejectStory(payload.id, payload.reason || undefined);
  }

  onAmend(payload: AmendPayload): void {
    this.session.amendStory(payload.id, payload.patch);
  }

  onFeedback(payload: FeedbackPayload): void {
    this.analysisService.regenerate({
      targetType: 'story',
      targetId: payload.id,
      feedback: payload.feedback,
    });
  }

  trackStory(_: number, story: UserStory): string {
    return story.id;
  }

  proceedToTasks(): void {
    void this.router.navigate(['/tasks']);
  }
}
