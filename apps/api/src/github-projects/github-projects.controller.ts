import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { GithubProjectsService } from './github-projects.service';
import { GithubProjectsContextService } from './github-projects-context.service';
import { GithubProjectsPublishService, PublishItem } from './github-projects-publish.service';
import { GitHubProjectsConnection, GitHubProjectItem, GitHubPublishSession } from '@smart-backlog/shared';

interface ConfigureBody {
  owner: string;
  projectNumber: number;
  repoOwner: string;
  repoName: string;
}

interface PublishBody {
  confirmed: boolean;
  items: PublishItem[];
}

@Controller('github-projects')
export class GithubProjectsController {
  constructor(
    private readonly projectsService: GithubProjectsService,
    private readonly contextService: GithubProjectsContextService,
    private readonly publishService: GithubProjectsPublishService,
  ) {}

  @Get('status')
  getStatus(): GitHubProjectsConnection {
    return this.projectsService.getStatus();
  }

  @Post('configure')
  async configure(@Body() body: ConfigureBody): Promise<GitHubProjectsConnection> {
    if (!body.owner || !body.repoOwner || !body.repoName || !body.projectNumber) {
      throw new BadRequestException('owner, projectNumber, repoOwner, and repoName are required.');
    }
    return this.projectsService.configure(body.owner, Number(body.projectNumber), body.repoOwner, body.repoName);
  }

  @Get('boards')
  async listBoards(@Query('owner') owner: string): Promise<{ boards: { number: number; title: string }[] }> {
    if (!owner) throw new BadRequestException('owner query parameter is required');
    const boards = await this.projectsService.listBoards(owner);
    return { boards };
  }

  @Get('items')
  async getItems(): Promise<{ items: GitHubProjectItem[]; truncated: boolean }> {
    const connection = this.projectsService.getStatus();
    if (connection.status !== 'active') {
      throw new BadRequestException('No active GitHub Projects connection. Configure one first via POST /api/github-projects/configure.');
    }
    return this.contextService.fetchItems(connection.owner, connection.projectNumber);
  }

  @Post('publish')
  async publish(@Body() body: PublishBody): Promise<GitHubPublishSession> {
    if (!body.confirmed) {
      throw new BadRequestException('Publish requires explicit confirmation. Set confirmed: true in the request body.');
    }
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('No items to publish. At least one approved story is required.');
    }
    const connection = this.projectsService.getStatus();
    if (connection.status !== 'active') {
      throw new BadRequestException('No active GitHub Projects connection.');
    }
    return this.publishService.publish(body.items);
  }
}
