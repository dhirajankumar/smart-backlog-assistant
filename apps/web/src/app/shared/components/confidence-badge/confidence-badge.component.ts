import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Confidence } from '@smart-backlog/shared';

@Component({
  standalone: true,
  selector: 'app-confidence-badge',
  imports: [MatChipsModule, MatIconModule, MatButtonModule],
  templateUrl: './confidence-badge.component.html',
  styleUrl: './confidence-badge.component.scss',
})
export class ConfidenceBadgeComponent {
  @Input({ required: true }) confidence!: Confidence;
  @Output() acknowledged = new EventEmitter<void>();

  readonly Confidence = Confidence;

  hasAcknowledged = false;

  get chipClass(): string {
    switch (this.confidence) {
      case Confidence.High:   return 'chip-high';
      case Confidence.Medium: return 'chip-medium';
      case Confidence.Low:    return 'chip-low';
      default:                return '';
    }
  }

  acknowledge(): void {
    this.hasAcknowledged = true;
    this.acknowledged.emit();
  }
}
