import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AppLogger } from '../common/logger/app-logger.service';
import { GithubMcpCredentialsService } from './github-mcp-credentials.service';

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

@Injectable()
export class GithubMcpClientService implements OnModuleInit, OnApplicationShutdown {
  private client: Client | null = null;
  private connected = false;
  private shuttingDown = false;
  private reconnectAttempts = 0;

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
    this.shuttingDown = true;
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const token = this.credentials.getToken();
      // When packaged with pkg, spawn the bundled local copy instead of fetching via npx
      const isPkg = typeof (process as any).pkg !== 'undefined';
      const command = isPkg ? 'node' : 'npx';
      const args = isPkg
        ? [path.join(path.dirname(process.execPath), 'github-mcp-server', 'dist', 'index.js'), 'stdio']
        : ['-y', 'github-mcp-server', 'stdio'];
      const transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
      });

      (transport as any).onclose = () => {
        this.connected = false;
        if (this.shuttingDown) return;
        const msg = 'GitHub connection lost — attempting to reconnect';
        this.connectionLost$.next(msg);
        this.logger.warn(msg, 'GithubMcpClientService');
        this.scheduleReconnect();
      };

      const client = new Client({ name: 'backlog-assistant', version: '1.0.0' }, { capabilities: {} });
      await client.connect(transport);
      this.client = client;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.logger.log('GitHub MCP client connected', 'GithubMcpClientService');
    } catch (err) {
      this.logger.error(`Failed to connect GitHub MCP client: ${(err as Error).message}`, undefined, 'GithubMcpClientService');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.logger.error('GitHub MCP client max reconnect attempts reached — giving up', undefined, 'GithubMcpClientService');
      }
      return;
    }
    this.reconnectAttempts++;
    this.logger.log(`GitHub MCP reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY_MS}ms`, 'GithubMcpClientService');
    setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
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
