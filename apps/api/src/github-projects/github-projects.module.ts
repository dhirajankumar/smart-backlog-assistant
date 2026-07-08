import { Module } from '@nestjs/common';
import { GithubProjectsController } from './github-projects.controller';
import { GithubProjectsService } from './github-projects.service';
import { GithubProjectsContextService } from './github-projects-context.service';
import { GithubProjectsPublishService } from './github-projects-publish.service';

@Module({
  controllers: [GithubProjectsController],
  providers: [GithubProjectsService, GithubProjectsContextService, GithubProjectsPublishService],
  exports: [GithubProjectsService, GithubProjectsContextService],
})
export class GithubProjectsModule {}
