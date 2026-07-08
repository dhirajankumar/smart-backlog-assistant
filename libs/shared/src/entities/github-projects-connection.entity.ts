export type GitHubConnectionStatus = 'active' | 'error' | 'unconfigured';

export interface GitHubProjectsConnection {
  owner: string;
  projectNumber: number;
  projectName: string;
  repoOwner: string;
  repoName: string;
  status: GitHubConnectionStatus;
  errorMessage: string | null;
  itemCount: number | null;
}
