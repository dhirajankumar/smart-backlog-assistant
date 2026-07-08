import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { GitHubProjectsConnection } from '@smart-backlog/shared';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-github-projects-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="settings-container">
      <h2>GitHub Projects Settings</h2>

      <form (ngSubmit)="testConnection()" #form="ngForm">
        <div class="field-group">
          <label for="owner">Organization / Username</label>
          <input id="owner" name="owner" type="text" [(ngModel)]="owner" placeholder="e.g. myorg" required />
        </div>

        <div class="field-group">
          <label for="repoOwner">Repository Owner</label>
          <input id="repoOwner" name="repoOwner" type="text" [(ngModel)]="repoOwner" placeholder="e.g. myorg" required />
        </div>

        <div class="field-group">
          <label for="repoName">Repository Name</label>
          <input id="repoName" name="repoName" type="text" [(ngModel)]="repoName" placeholder="e.g. product-backend" required />
        </div>

        <div class="field-group">
          <label for="projectNumber">Project Board</label>
          <div class="board-select-row">
            <button type="button" (click)="loadBoards()" [disabled]="!owner || isLoadingBoards" class="btn-secondary">
              {{ isLoadingBoards ? 'Loading…' : 'Load Boards' }}
            </button>
            <select id="projectNumber" name="projectNumber" [(ngModel)]="selectedProjectNumber" [disabled]="boards.length === 0">
              <option [value]="0" disabled>Select a project board</option>
              <option *ngFor="let board of boards" [value]="board.number">{{ board.title }} (#{{ board.number }})</option>
            </select>
          </div>
        </div>

        <button type="submit" class="btn-primary" [disabled]="!canTest || isTesting">
          {{ isTesting ? 'Testing…' : 'Test Connection' }}
        </button>
      </form>

      <div *ngIf="successMessage" class="status-success">
        <strong>Connected</strong> — {{ successMessage }}
      </div>

      <div *ngIf="errorMessage" class="status-error">
        <strong>Error:</strong> {{ errorMessage }}
      </div>

      <div class="nav-back">
        <a routerLink="/">← Back to home</a>
      </div>
    </div>
  `,
  styles: [`
    .settings-container { max-width: 480px; margin: 2rem auto; padding: 1.5rem; }
    h2 { margin-bottom: 1.5rem; }
    .field-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    label { font-weight: 500; font-size: 0.9rem; }
    input, select { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    .board-select-row { display: flex; gap: 0.5rem; align-items: center; }
    .btn-primary { padding: 0.6rem 1.2rem; background: #0366d6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 0.5rem; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 0.4rem 0.8rem; background: #f6f8fa; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-success { margin-top: 1rem; padding: 0.75rem; background: #dcffe4; border: 1px solid #34d058; border-radius: 4px; color: #176321; }
    .status-error { margin-top: 1rem; padding: 0.75rem; background: #ffdce0; border: 1px solid #d73a49; border-radius: 4px; color: #86181d; }
    .nav-back { margin-top: 1.5rem; }
    .nav-back a { color: #0366d6; text-decoration: none; }
  `],
})
export class GithubProjectsConfigComponent implements OnInit {
  owner = '';
  repoOwner = '';
  repoName = '';
  selectedProjectNumber = 0;
  boards: { number: number; title: string }[] = [];
  isLoadingBoards = false;
  isTesting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  get canTest(): boolean {
    return !!this.owner && !!this.repoOwner && !!this.repoName && this.selectedProjectNumber > 0;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot.githubConnection?.status === 'active') {
      const c = snapshot.githubConnection;
      this.owner = c.owner;
      this.repoOwner = c.repoOwner;
      this.repoName = c.repoName;
      this.selectedProjectNumber = c.projectNumber;
    }
  }

  loadBoards(): void {
    if (!this.owner) return;
    this.isLoadingBoards = true;
    this.http.get<{ boards: { number: number; title: string }[] }>(`/api/github-projects/boards?owner=${encodeURIComponent(this.owner)}`)
      .subscribe({
        next: res => {
          this.boards = res.boards;
          this.isLoadingBoards = false;
        },
        error: err => {
          this.errorMessage = err?.error?.message ?? 'Failed to load boards';
          this.isLoadingBoards = false;
        },
      });
  }

  testConnection(): void {
    if (!this.canTest || this.isTesting) return;
    this.isTesting = true;
    this.successMessage = null;
    this.errorMessage = null;

    this.http.post<GitHubProjectsConnection>('/api/github-projects/configure', {
      owner: this.owner,
      projectNumber: this.selectedProjectNumber,
      repoOwner: this.repoOwner,
      repoName: this.repoName,
    }).subscribe({
      next: connection => {
        this.session.setGithubConnection(connection);
        this.successMessage = `${connection.projectName}${connection.itemCount !== null ? ` (${connection.itemCount} items)` : ''}`;
        this.isTesting = false;
      },
      error: err => {
        this.errorMessage = err?.error?.message ?? 'Connection failed';
        this.isTesting = false;
      },
    });
  }
}
