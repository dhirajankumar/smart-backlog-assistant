import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GitHubProjectItem } from '@smart-backlog/shared';
import { SessionService } from '../../core/session.service';
import { GithubBacklogService } from './github-backlog.service';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './backlog.component.html',
  styleUrl: './backlog.component.scss',
})
export class BacklogComponent implements OnInit {
  readonly items = signal<GitHubProjectItem[]>([]);
  readonly isLoading = signal(false);
  readonly truncated = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly statusFilter = signal('All');
  readonly priorityFilter = signal('All');
  readonly expandedItemId = signal<number | null>(null);

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();

    return this.items().filter(item => {
      const matchesSearch = !term || item.title.toLowerCase().includes(term);
      const matchesStatus = status === 'All' || item.status === status;
      const matchesPriority = priority === 'All' || item.priority === priority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  });

  readonly availableStatuses = computed(() => {
    const statuses = new Set(this.items().map(i => i.status));
    return ['All', ...Array.from(statuses)];
  });

  readonly availablePriorities = computed(() => {
    const priorities = new Set(this.items().filter(i => i.priority).map(i => i.priority!));
    return ['All', ...Array.from(priorities)];
  });

  constructor(
    readonly session: SessionService,
    private readonly backlogService: GithubBacklogService,
  ) {}

  ngOnInit(): void {
    this.session.isGithubConnected$.subscribe(connected => {
      if (connected) this.loadItems();
    });
  }

  loadItems(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.backlogService.fetchItems().subscribe({
      next: res => {
        this.items.set(res.items);
        this.truncated.set(res.truncated);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  toggleExpand(issueNumber: number): void {
    this.expandedItemId.update(id => id === issueNumber ? null : issueNumber);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('All');
    this.priorityFilter.set('All');
  }

  trackByIssue(_: number, item: GitHubProjectItem): number {
    return item.issueNumber;
  }
}
