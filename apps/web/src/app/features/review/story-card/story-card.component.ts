import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CATEGORIES, Confidence, ItemStatus, Priority, UserStory } from '@smart-backlog/shared';
import { ConfidenceBadgeComponent } from '../../../shared/components/confidence-badge/confidence-badge.component';
import { OverlapFlagComponent } from '../../../shared/components/overlap-flag/overlap-flag.component';

export interface AmendPayload {
  id: string;
  patch: Partial<Pick<UserStory, 'title' | 'role' | 'benefit' | 'acceptanceCriteria' | 'priority' | 'category'>>;
}

export interface FeedbackPayload {
  id: string;
  feedback: string;
}

export interface RejectPayload {
  id: string;
  reason: string;
}

@Component({
  standalone: true,
  selector: 'app-story-card',
  imports: [
    FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    ConfidenceBadgeComponent, OverlapFlagComponent,
  ],
  templateUrl: './story-card.component.html',
  styleUrl: './story-card.component.scss',
})
export class StoryCardComponent implements OnChanges {
  @Input({ required: true }) story!: UserStory;

  @Output() approve = new EventEmitter<string>();
  @Output() reject = new EventEmitter<RejectPayload>();
  @Output() amend = new EventEmitter<AmendPayload>();
  @Output() feedback = new EventEmitter<FeedbackPayload>();

  readonly ItemStatus = ItemStatus;
  readonly Confidence = Confidence;
  readonly Priority = Priority;
  readonly CATEGORIES = CATEGORIES;
  readonly priorityOptions = [Priority.High, Priority.Medium, Priority.Low];

  lowConfidenceAcknowledged = false;
  isEditing = false;
  showApprove = false;
  showReject = false;
  showFeedback = false;

  editTitle = '';
  editRole = '';
  editBenefit = '';
  editCriteriaText = '';
  editPriority: Priority = Priority.Medium;
  editCategory = '';

  approveNote = '';
  rejectReason = '';
  feedbackText = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['story']) {
      this.lowConfidenceAcknowledged = false;
      this.isEditing = false;
      this.showApprove = false;
      this.showReject = false;
      this.showFeedback = false;
    }
  }

  get canApprove(): boolean {
    const needsAck = this.story.confidence === Confidence.Low && !this.lowConfidenceAcknowledged;
    return !needsAck;
  }

  get statusClass(): string {
    return {
      [ItemStatus.Approved]: 'status--approved',
      [ItemStatus.Amended]:  'status--amended',
      [ItemStatus.Rejected]: 'status--rejected',
      [ItemStatus.Draft]:    'status--draft',
    }[this.story.status] ?? 'status--draft';
  }

  get priorityClass(): string {
    return {
      [Priority.High]:   'priority--high',
      [Priority.Medium]: 'priority--medium',
      [Priority.Low]:    'priority--low',
    }[this.story.priority] ?? '';
  }

  onAcknowledged(): void {
    this.lowConfidenceAcknowledged = true;
  }

  toggleApprove(): void {
    if (!this.canApprove) return;
    this.showApprove = !this.showApprove;
    if (this.showApprove) {
      this.approveNote = '';
      this.showReject = false;
      this.showFeedback = false;
      this.isEditing = false;
    }
  }

  confirmApprove(): void {
    this.approve.emit(this.story.id);
    this.showApprove = false;
    this.approveNote = '';
  }

  onApprove(): void {
    if (!this.canApprove) return;
    this.approve.emit(this.story.id);
  }

  toggleReject(): void {
    this.showReject = !this.showReject;
    if (this.showReject) {
      this.rejectReason = '';
      this.showFeedback = false;
      this.showApprove = false;
      this.isEditing = false;
    }
  }

  confirmReject(): void {
    this.reject.emit({ id: this.story.id, reason: this.rejectReason });
    this.showReject = false;
    this.rejectReason = '';
  }

  startEdit(): void {
    this.editTitle = this.story.title;
    this.editRole = this.story.role;
    this.editBenefit = this.story.benefit;
    this.editCriteriaText = this.story.acceptanceCriteria.join('\n');
    this.editPriority = this.story.priority;
    this.editCategory = this.story.category;
    this.isEditing = true;
    this.showApprove = false;
    this.showReject = false;
    this.showFeedback = false;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  saveEdit(): void {
    this.amend.emit({
      id: this.story.id,
      patch: {
        title: this.editTitle.trim(),
        role: this.editRole.trim(),
        benefit: this.editBenefit.trim(),
        acceptanceCriteria: this.editCriteriaText.split('\n').map(l => l.trim()).filter(Boolean),
        priority: this.editPriority,
        category: this.editCategory,
      },
    });
    this.isEditing = false;
  }

  toggleFeedback(): void {
    this.showFeedback = !this.showFeedback;
    if (this.showFeedback) {
      this.feedbackText = '';
      this.showApprove = false;
      this.showReject = false;
      this.isEditing = false;
    }
  }

  onRegenerate(): void {
    if (!this.feedbackText.trim()) return;
    this.feedback.emit({ id: this.story.id, feedback: this.feedbackText.trim() });
    this.showFeedback = false;
    this.feedbackText = '';
  }
}
