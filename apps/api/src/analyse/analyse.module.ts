import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LIMITS } from '@smart-backlog/shared';
import { AiModule } from '../ai/ai.module';
import { PdfModule } from '../pdf/pdf.module';
import { OverlapModule } from '../overlap/overlap.module';

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
})
export class AnalyseModule {}
