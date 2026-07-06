import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { RegenerateService } from './regenerate.service';
import { RegenerateDto } from './regenerate.dto';

@Controller('regenerate')
export class RegenerateController {
  constructor(private readonly regenerateService: RegenerateService) {}

  @Post()
  stream(@Body() dto: RegenerateDto, @Res() res: Response): Promise<void> {
    return this.pipeSse(this.regenerateService.stream(dto), res);
  }

  private pipeSse(
    source: import('rxjs').Observable<import('@nestjs/common').MessageEvent>,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    return new Promise<void>((resolve) => {
      const sub = source.subscribe({
        next: (event) => {
          const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          res.write(`data: ${data}\n\n`);
        },
        error: () => {
          res.end();
          resolve();
        },
        complete: () => {
          res.end();
          resolve();
        },
      });

      res.on('close', () => {
        sub.unsubscribe();
        resolve();
      });
    });
  }
}
