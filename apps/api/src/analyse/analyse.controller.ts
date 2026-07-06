import {
  Body,
  Controller,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Task } from '@smart-backlog/shared';
import { AnalyseService } from './analyse.service';
import { AnalyseDto, AnalyseTasksDto } from './analyse.dto';

@Controller('analyse')
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdfFile', maxCount: 1 },
      { name: 'backlogJson', maxCount: 1 },
    ]),
  )
  stream(
    @Body() dto: AnalyseDto,
    @UploadedFiles()
    files: { pdfFile?: Express.Multer.File[]; backlogJson?: Express.Multer.File[] },
    @Res() res: Response,
  ): Promise<void> {
    const pdfBuffer = files?.pdfFile?.[0]?.buffer;
    const backlogBuffer = files?.backlogJson?.[0]?.buffer;
    return this.pipeSse(this.analyseService.stream(dto, pdfBuffer, backlogBuffer), res);
  }

  @Post('tasks')
  @UseInterceptors(FileFieldsInterceptor([]))
  async tasks(@Body() dto: AnalyseTasksDto): Promise<Task[]> {
    return this.analyseService.generateTasks(dto);
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
