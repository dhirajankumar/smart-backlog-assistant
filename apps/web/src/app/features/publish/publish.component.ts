import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GitHubPublishSession, ItemStatus } from '@smart-backlog/shared';
import { SessionService } from '../../core/session.service';
import { GithubPublishConfirmationComponent } from './github-publish-confirmation.component';
import { GithubPublishResultsComponent } from './github-publish-results.component';

@Component({
  selector: 'app-publish',
  standalone: true,
  imports: [CommonModule, RouterModule, GithubPublishConfirmationComponent, GithubPublishResultsComponent],
  template: `
    <div class="publish-page">
      <h1>Publish Results</h1>

      <div class="publish-summary">
        <p>{{ approvedCount }} approved stories ready to publish.</p>
      </div>

      <ng-container *ngIf="session.isGithubConnected$ | async; else noGitHub">
        <div class="publish-actions">
          <button class="btn-primary" (click)="showConfirmation = true" [disabled]="approvedCount === 0 || isPublishing">
            Publish to GitHub Projects
          </button>
        </div>

        <app-github-publish-confirmation
          *ngIf="showConfirmation"
          [items]="approvedItems"
          [isPublishing]="isPublishing"
          (confirmed)="onConfirmed()"
          (cancelled)="showConfirmation = false"
        ></app-github-publish-confirmation>

        <app-github-publish-results
          *ngIf="publishSession"
          [session]="publishSession!"
          (retryFailed)="onRetryFailed()"
        ></app-github-publish-results>
      </ng-container>

      <ng-template #noGitHub>
        <div class="no-github-notice">
          <p>Connect GitHub Projects to publish directly, or download as JSON below.</p>
          <a routerLink="/settings/github-projects" class="btn-secondary">Configure GitHub Projects</a>
        </div>
        <div class="download-section">
          <button class="btn-primary" (click)="downloadJson()" [disabled]="approvedCount === 0">
            Download JSON
          </button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .publish-page { max-width: 700px; margin: 0 auto; }
    .publish-summary { margin-bottom: 1.5rem; color: #57606a; }
    .publish-actions { margin-bottom: 1.5rem; }
    .btn-primary { padding: 0.6rem 1.2rem; background: #0366d6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { display: inline-block; padding: 0.5rem 1rem; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; color: #24292e; }
    .no-github-notice { padding: 1rem; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; margin-bottom: 1.5rem; }
    .download-section { margin-top: 1rem; }
  `],
})
export class PublishComponent {
  showConfirmation = false;
  isPublishing = false;
  publishSession: GitHubPublishSession | null = null;

  get approvedItems() {
    const state = this.session.getSnapshot();
    const stories = state.stories.filter(s => s.status === ItemStatus.Approved || s.status === ItemStatus.Amended);
    return stories.flatMap(story => {
      const storyItem = { internalItemId: story.id, type: 'story' as const, title: story.title, description: story.benefit, acceptanceCriteria: story.acceptanceCriteria, priority: story.priority, category: story.category };
      const tasks = (state.tasks[story.id] ?? [])
        .filter(t => t.status === ItemStatus.Approved || t.status === ItemStatus.Amended)
        .map(t => ({ internalItemId: t.id, type: 'task' as const, parentInternalItemId: story.id, title: t.title, description: t.description, priority: t.priority, category: t.category }));
      return [storyItem, ...tasks];
    });
  }

  get approvedCount(): number {
    return this.session.getSnapshot().stories.filter(s => s.status === ItemStatus.Approved || s.status === ItemStatus.Amended).length;
  }

  constructor(
    readonly session: SessionService,
    private readonly http: HttpClient,
  ) {}

  onConfirmed(): void {
    this.isPublishing = true;
    this.http.post<GitHubPublishSession>('/api/github-projects/publish', {
      confirmed: true,
      items: this.approvedItems,
    }).subscribe({
      next: session => {
        this.publishSession = session;
        this.session.setGithubPublishSession(session);
        this.isPublishing = false;
        this.showConfirmation = false;
      },
      error: err => {
        this.isPublishing = false;
        this.showConfirmation = false;
        console.error('Publish failed', err);
      },
    });
  }

  onRetryFailed(): void {
    const retryItems = this.approvedItems.filter(item => {
      const result = this.publishSession?.results.find(r => r.internalItemId === item.internalItemId);
      return result?.retryEligible;
    });
    if (retryItems.length === 0) return;

    this.isPublishing = true;
    this.http.post<GitHubPublishSession>('/api/github-projects/publish', {
      confirmed: true,
      items: retryItems,
    }).subscribe({
      next: session => {
        this.publishSession = session;
        this.session.setGithubPublishSession(session);
        this.isPublishing = false;
      },
      error: () => { this.isPublishing = false; },
    });
  }

  downloadJson(): void {
    try {
      const data = this.session.buildExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backlog-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  }
}
