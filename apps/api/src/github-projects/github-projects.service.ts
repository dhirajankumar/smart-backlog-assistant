import { Injectable, NotFoundException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GitHubProjectsConnection } from '@smart-backlog/shared';
import { GithubMcpClientService } from '../github-mcp/github-mcp-client.service';
import { AppLogger } from '../common/logger/app-logger.service';

@Injectable()
export class GithubProjectsService {
  private connection: GitHubProjectsConnection = {
    owner: '',
    projectNumber: 0,
    projectName: '',
    repoOwner: '',
    repoName: '',
    status: 'unconfigured',
    errorMessage: null,
    itemCount: null,
  };

  constructor(
    private readonly mcpClient: GithubMcpClientService,
    private readonly logger: AppLogger,
  ) {}

  getStatus(): GitHubProjectsConnection {
    return { ...this.connection };
  }

  async configure(owner: string, projectNumber: number, repoOwner: string, repoName: string): Promise<GitHubProjectsConnection> {
    if (!this.mcpClient.isConnected()) {
      throw new ServiceUnavailableException('GitHub MCP server is not running. Ensure GITHUB_TOKEN is set in .env and restart the app.');
    }

    try {
      const result = await this.mcpClient.callTool('get_project', { owner, project_number: projectNumber }) as any;
      if (result?.isError) {
        throw new Error(result?.content?.[0]?.text ?? 'Unknown MCP error');
      }
      const projectName: string = result?.content?.[0]?.text
        ? JSON.parse(result.content[0].text)?.title ?? `Project #${projectNumber}`
        : `Project #${projectNumber}`;

      let itemCount: number | null = null;
      try {
        const itemsResult = await this.mcpClient.callTool('list_project_items', {
          owner,
          project_number: projectNumber,
          per_page: 1,
        }) as any;
        const parsed = itemsResult?.content?.[0]?.text ? JSON.parse(itemsResult.content[0].text) : null;
        itemCount = parsed?.totalCount ?? null;
      } catch {
        // Item count is informational — don't fail configure on this
      }

      this.connection = {
        owner,
        projectNumber,
        projectName,
        repoOwner,
        repoName,
        status: 'active',
        errorMessage: null,
        itemCount,
      };

      this.logger.log(`GitHub Projects configured: ${owner}/#${projectNumber}`, 'GithubProjectsService');
      return { ...this.connection };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);

      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        throw new UnauthorizedException('GitHub token is missing or invalid. Update GITHUB_TOKEN in .env with a valid classic PAT (required scopes: project, repo).');
      }
      if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('scope')) {
        throw new ForbiddenException('Insufficient GitHub token scopes. Required: project, repo. Visit github.com/settings/tokens to regenerate.');
      }
      if (msg.includes('404') || msg.includes('Not Found') || msg.includes('not found')) {
        throw new NotFoundException(`GitHub project #${projectNumber} not found for owner '${owner}'. Check the project number and token permissions.`);
      }

      this.connection = { ...this.connection, owner, projectNumber, repoOwner, repoName, status: 'error', errorMessage: msg };
      throw new ServiceUnavailableException(msg);
    }
  }

  async listBoards(owner: string): Promise<{ number: number; title: string }[]> {
    if (!this.mcpClient.isConnected()) {
      throw new ServiceUnavailableException('GitHub MCP server is not running. Ensure GITHUB_TOKEN is set in .env and restart the app.');
    }

    const result = await this.mcpClient.callTool('list_projects', { owner, per_page: 20 }) as any;
    this.logger.log(`list_projects raw result: ${JSON.stringify(result)?.slice(0, 500)}`, 'GithubProjectsService');

    if (result?.isError) {
      const errText = result?.content?.[0]?.text ?? 'Unknown MCP error';
      if (errText.includes('401') || errText.toLowerCase().includes('unauthorized')) {
        throw new UnauthorizedException('GitHub token is missing or invalid. Update GITHUB_TOKEN in .env with a valid classic PAT (required scopes: project, repo).');
      }
      throw new ServiceUnavailableException(`GitHub API error: ${errText}`);
    }

    const text = result?.content?.[0]?.text;
    if (!text) {
      this.logger.warn(`list_projects returned no text content for owner '${owner}'`, 'GithubProjectsService');
      return [];
    }

    try {
      const parsed = JSON.parse(text);

      // GitHub API error bodies (e.g. 403/404) arrive as { message: "..." }
      if (parsed?.message && !parsed?.projects && !Array.isArray(parsed)) {
        throw new ServiceUnavailableException(`GitHub API error: ${parsed.message}`);
      }

      const projects: Array<{ number: number; title: string }> = Array.isArray(parsed)
        ? parsed
        : parsed?.projects ?? parsed?.nodes ?? [];
      return projects
        .filter((p: any) => p.number != null && p.title != null)
        .map((p: any) => ({ number: Number(p.number), title: String(p.title) }));
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`list_projects JSON parse failed: ${(err as Error).message}`, 'GithubProjectsService');
      return [];
    }
  }

  setErrorStatus(message: string): void {
    this.connection = { ...this.connection, status: 'error', errorMessage: message };
  }
}
