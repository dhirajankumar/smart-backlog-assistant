import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { GitHubProjectItem } from '@smart-backlog/shared';

export interface BacklogItemsResponse {
  items: GitHubProjectItem[];
  truncated: boolean;
}

@Injectable({ providedIn: 'root' })
export class GithubBacklogService {
  constructor(private readonly http: HttpClient) {}

  fetchItems(): Observable<BacklogItemsResponse> {
    return this.http.get<BacklogItemsResponse>('/api/github-projects/items').pipe(
      catchError((err: HttpErrorResponse) =>
        throwError(() => new Error(err.error?.message ?? `Failed to fetch backlog items (${err.status})`))
      )
    );
  }
}
