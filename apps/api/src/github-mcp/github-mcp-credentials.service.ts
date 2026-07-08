import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubMcpCredentialsService {
  constructor(private readonly config: ConfigService) {}

  getTokenPresent(): boolean {
    const token = this.config.get<string>('GITHUB_TOKEN');
    return !!token && token.length > 0;
  }

  getToken(): string {
    return this.config.get<string>('GITHUB_TOKEN') ?? '';
  }
}
