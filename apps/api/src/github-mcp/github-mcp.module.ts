import { Global, Module } from '@nestjs/common';
import { GithubMcpClientService } from './github-mcp-client.service';
import { GithubMcpCredentialsService } from './github-mcp-credentials.service';

@Global()
@Module({
  providers: [GithubMcpCredentialsService, GithubMcpClientService],
  exports: [GithubMcpClientService, GithubMcpCredentialsService],
})
export class GithubMcpModule {}
