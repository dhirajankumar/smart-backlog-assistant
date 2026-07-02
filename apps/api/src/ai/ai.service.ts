import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(_prompt: string, _signal?: AbortSignal): Promise<string> {
    throw new Error('AiService.complete not yet implemented — pending T010');
  }
}
