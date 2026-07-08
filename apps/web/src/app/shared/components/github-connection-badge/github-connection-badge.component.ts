import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../../core/session.service';

@Component({
  selector: 'app-github-connection-badge',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <ng-container *ngIf="session.githubConnection$ | async as conn">
      <a routerLink="/settings/github-projects" class="badge"
         [class.badge--active]="conn.status === 'active'"
         [class.badge--error]="conn.status === 'error'"
         [class.badge--unconfigured]="conn.status === 'unconfigured'"
         [title]="conn.errorMessage ?? ''">
        <span class="badge__dot"></span>
        <span *ngIf="conn.status === 'active'">Connected — {{ conn.projectName }}</span>
        <span *ngIf="conn.status === 'error'">GitHub — Error</span>
        <span *ngIf="conn.status === 'unconfigured'">GitHub — Not configured</span>
      </a>
    </ng-container>
    <ng-container *ngIf="!(session.githubConnection$ | async)">
      <a routerLink="/settings/github-projects" class="badge badge--unconfigured">
        <span class="badge__dot"></span>
        <span>GitHub — Not configured</span>
      </a>
    </ng-container>
  `,
  styles: [`
    .badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.8rem;
      text-decoration: none; transition: opacity 0.15s;
    }
    .badge:hover { opacity: 0.8; }
    .badge__dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .badge--active { background: #dcffe4; color: #176321; }
    .badge--active .badge__dot { background: #34d058; }
    .badge--error { background: #ffdce0; color: #86181d; }
    .badge--error .badge__dot { background: #d73a49; }
    .badge--unconfigured { background: #f6f8fa; color: #586069; border: 1px solid #e1e4e8; }
    .badge--unconfigured .badge__dot { background: #959da5; }
  `],
})
export class GithubConnectionBadgeComponent {
  constructor(readonly session: SessionService) {}
}
