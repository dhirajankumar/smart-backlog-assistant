import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Sse,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { Task } from '@smart-backlog/shared';
import { AnalyseService } from './analyse.service';
import { AnalyseDto, AnalyseTasksDto } from './analyse.dto';

@Controller('analyse')
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Sse()
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
  ): Observable<MessageEvent> {
    const pdfBuffer = files?.pdfFile?.[0]?.buffer;
    const backlogBuffer = files?.backlogJson?.[0]?.buffer;
    return this.analyseService.stream(dto, pdfBuffer, backlogBuffer);
  }

  @Post('tasks')
  @UseInterceptors(FileFieldsInterceptor([]))
  async tasks(@Body() dto: AnalyseTasksDto): Promise<Task[]> {
    return this.analyseService.generateTasks(dto);
  }
}
