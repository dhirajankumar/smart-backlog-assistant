import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PublishItemSummary {
  internalItemId: string;
  type: 'story' | 'task';
  title: string;
  parentInternalItemId?: string;
}

@Component({
  selector: 'app-github-publish-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="cancelled.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <h2>Publish to GitHub Projects</h2>
        <p class="modal-subtitle">The following items will be created as GitHub Issues:</p>

        <ul class="items-list">
          <li *ngFor="let item of items" [class.items-list__task]="item.type === 'task'">
            <span class="item-type-badge" [class.badge--task]="item.type === 'task'">{{ item.type }}</span>
            {{ item.title }}
          </li>
        </ul>

        <p class="modal-count">{{ storyCount }} stories, {{ taskCount }} tasks</p>

        <div class="modal-actions">
          <button class="btn-cancel" (click)="cancelled.emit()" [disabled]="isPublishing">Cancel</button>
          <button class="btn-confirm" (click)="confirmed.emit()" [disabled]="isPublishing">
            {{ isPublishing ? 'Publishing…' : 'Confirm & Publish' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-dialog { background: white; border-radius: 8px; padding: 1.5rem; max-width: 560px; width: 90%; max-height: 80vh; overflow-y: auto; }
    h2 { margin: 0 0 0.5rem; }
    .modal-subtitle { color: #57606a; margin-bottom: 1rem; }
    .items-list { list-style: none; padding: 0; margin: 0 0 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; max-height: 300px; overflow-y: auto; }
    .items-list li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; padding: 0.3rem 0.5rem; border-radius: 4px; background: #f6f8fa; }
    .items-list__task { margin-left: 1.5rem; background: #f0f6fc !important; }
    .item-type-badge { font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 10px; background: #0366d6; color: white; text-transform: uppercase; white-space: nowrap; }
    .badge--task { background: #6f42c1; }
    .modal-count { font-size: 0.85rem; color: #57606a; margin-bottom: 1.5rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .btn-cancel { padding: 0.5rem 1rem; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; cursor: pointer; }
    .btn-cancel:disabled { opacity: 0.5; }
    .btn-confirm { padding: 0.5rem 1.2rem; background: #2da44e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class GithubPublishConfirmationComponent {
  @Input() items: PublishItemSummary[] = [];
  @Input() isPublishing = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get storyCount(): number { return this.items.filter(i => i.type === 'story').length; }
  get taskCount(): number { return this.items.filter(i => i.type === 'task').length; }
}
