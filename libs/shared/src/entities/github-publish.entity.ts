export type GitHubPublishStatus = 'created' | 'failed' | 'skipped';

export interface GitHubPublishResult {
  internalItemId: string;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  status: GitHubPublishStatus;
  errorMessage: string | null;
  retryEligible: boolean;
}

export interface GitHubPublishSession {
  publishTimestamp: Date;
  projectOwner: string;
  projectNumber: number;
  repoOwner: string;
  repoName: string;
  results: GitHubPublishResult[];
}
