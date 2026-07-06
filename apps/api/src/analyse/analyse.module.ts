import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LIMITS } from '@smart-backlog/shared';
import { AiModule } from '../ai/ai.module';
import { PdfModule } from '../pdf/pdf.module';
import { OverlapModule } from '../overlap/overlap.module';
import { AnalyseController } from './analyse.controller';
import { AnalyseService } from './analyse.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: LIMITS.MAX_PDF_SIZE_BYTES,
      },
    }),
    AiModule,
    PdfModule,
    OverlapModule,
  ],
  controllers: [AnalyseController],
  providers: [AnalyseService],
  exports: [AnalyseService],
})
export class AnalyseModule {}
