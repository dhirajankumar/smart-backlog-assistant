import { Injectable } from '@nestjs/common';
import { GitHubProjectItem } from '@smart-backlog/shared';
import { GithubMcpClientService } from '../github-mcp/github-mcp-client.service';
import { AppLogger } from '../common/logger/app-logger.service';

const MAX_ITEMS = 200;

@Injectable()
export class GithubProjectsContextService {
  constructor(
    private readonly mcpClient: GithubMcpClientService,
    private readonly logger: AppLogger,
  ) {}

  async fetchItems(owner: string, projectNumber: number): Promise<{ items: GitHubProjectItem[]; truncated: boolean }> {
    const items: GitHubProjectItem[] = [];
    let cursor: string | null = null;
    let totalFetched = 0;
    let hasMore = true;

    while (hasMore && items.length < MAX_ITEMS) {
      const args: Record<string, unknown> = { owner, project_number: projectNumber, per_page: 100 };
      if (cursor) args['after'] = cursor;

      const result = await this.mcpClient.callTool('list_project_items', args) as any;
      const text = result?.content?.[0]?.text;
      if (!text) break;

      let page: any;
      try {
        page = JSON.parse(text);
      } catch {
        break;
      }

      const pageItems: any[] = Array.isArray(page) ? page : page?.items ?? [];
      for (const raw of pageItems) {
        if (items.length >= MAX_ITEMS) break;
        items.push(this.mapItem(raw));
      }

      totalFetched += pageItems.length;
      cursor = page?.nextCursor ?? null;
      hasMore = !!cursor && pageItems.length > 0;
    }

    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const truncated = totalFetched > MAX_ITEMS || (hasMore && items.length === MAX_ITEMS);
    this.logger.log(`Fetched ${items.length} items from GitHub Project ${owner}/#${projectNumber}${truncated ? ' (truncated)' : ''}`, 'GithubProjectsContextService');

    return { items, truncated };
  }

  private mapItem(raw: any): GitHubProjectItem {
    return {
      issueNumber: raw.number ?? raw.issueNumber ?? 0,
      title: raw.title ?? '',
      body: raw.body ?? null,
      status: raw.state ?? raw.status ?? 'OPEN',
      priority: raw.priority ?? raw.fieldValues?.priority ?? null,
      labels: Array.isArray(raw.labels) ? raw.labels.map((l: any) => (typeof l === 'string' ? l : l.name)) : [],
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
      repositoryName: raw.repository?.name ?? raw.repositoryName ?? '',
    };
  }
}
