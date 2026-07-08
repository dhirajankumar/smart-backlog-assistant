export interface GitHubProjectItem {
  issueNumber: number;
  title: string;
  body: string | null;
  status: string;
  priority: string | null;
  labels: string[];
  updatedAt: Date;
  repositoryName: string;
}
