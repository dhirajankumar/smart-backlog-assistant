import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AppLogger } from '../common/logger/app-logger.service';
import { GithubMcpCredentialsService } from './github-mcp-credentials.service';

type McpClient = {
  connect(transport: unknown): Promise<void>;
  callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
  close(): Promise<void>;
};

@Injectable()
export class GithubMcpClientService implements OnModuleInit, OnApplicationShutdown {
  private client: McpClient | null = null;
  private connected = false;

  readonly connectionLost$ = new Subject<string>();

  constructor(
    private readonly credentials: GithubMcpCredentialsService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.credentials.getTokenPresent()) {
      this.logger.warn('GITHUB_TOKEN not set — GitHub MCP client will not connect', 'GithubMcpClientService');
      return;
    }
    await this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      // Dynamic import to avoid build-time failure when devDep is missing
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js' as string);
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js' as string);

      const token = this.credentials.getToken();
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', 'github-mcp-server', 'stdio'],
        env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
      });

      (transport as any).onclose = () => {
        this.connected = false;
        const msg = 'GitHub connection lost — please restart the app';
        this.connectionLost$.next(msg);
        this.logger.warn(msg, 'GithubMcpClientService');
      };

      const client = new Client({ name: 'backlog-assistant', version: '1.0.0' }, { capabilities: {} }) as McpClient;
      await client.connect(transport);
      this.client = client;
      this.connected = true;
      this.logger.log('GitHub MCP client connected', 'GithubMcpClientService');
    } catch (err) {
      this.logger.error(`Failed to connect GitHub MCP client: ${(err as Error).message}`, undefined, 'GithubMcpClientService');
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors on shutdown
      }
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error('GitHub MCP server is not running. Ensure GITHUB_TOKEN is set in .env and restart the app.');
    }
    return this.client.callTool({ name: toolName, arguments: args });
  }
}
