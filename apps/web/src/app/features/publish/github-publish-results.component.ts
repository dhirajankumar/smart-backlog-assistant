import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GitHubPublishSession } from '@smart-backlog/shared';

@Component({
  selector: 'app-github-publish-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="results-panel">
      <h3>Publish Results</h3>
      <p class="results-meta">
        Published {{ createdCount }} items — {{ failedCount }} failed.
      </p>

      <ul class="results-list">
        <li *ngFor="let result of session.results" class="result-item" [class.result-item--failed]="result.status === 'failed'" [class.result-item--skipped]="result.status === 'skipped'">
          <span class="result-status">
            <span *ngIf="result.status === 'created'">✓</span>
            <span *ngIf="result.status === 'failed'">✗</span>
            <span *ngIf="result.status === 'skipped'">–</span>
          </span>
          <span class="result-id">{{ result.internalItemId }}</span>
          <a *ngIf="result.githubIssueUrl" [href]="result.githubIssueUrl" target="_blank" rel="noopener" class="result-link">
            #{{ result.githubIssueNumber }}
          </a>
          <span *ngIf="result.status === 'failed'" class="result-error">{{ result.errorMessage }}</span>
        </li>
      </ul>

      <button *ngIf="failedCount > 0" class="btn-retry" (click)="retryFailed.emit()">
        Retry failed items ({{ failedCount }})
      </button>
    </div>
  `,
  styles: [`
    .results-panel { margin-top: 2rem; padding: 1.25rem; border: 1px solid #d0d7de; border-radius: 8px; }
    h3 { margin: 0 0 0.5rem; }
    .results-meta { color: #57606a; font-size: 0.9rem; margin-bottom: 1rem; }
    .results-list { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .result-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 4px; background: #dcffe4; font-size: 0.9rem; }
    .result-item--failed { background: #ffdce0; }
    .result-item--skipped { background: #f6f8fa; color: #57606a; }
    .result-status { font-weight: 700; width: 1rem; text-align: center; }
    .result-id { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: #57606a; }
    .result-link { color: #0366d6; text-decoration: none; font-weight: 600; white-space: nowrap; }
    .result-link:hover { text-decoration: underline; }
    .result-error { color: #86181d; font-size: 0.8rem; }
    .btn-retry { padding: 0.5rem 1rem; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  `],
})
export class GithubPublishResultsComponent {
  @Input() session!: GitHubPublishSession;
  @Output() retryFailed = new EventEmitter<void>();

  get createdCount(): number { return this.session.results.filter(r => r.status === 'created').length; }
  get failedCount(): number { return this.session.results.filter(r => r.status === 'failed').length; }
}
