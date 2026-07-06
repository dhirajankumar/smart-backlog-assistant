import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OverlapModule } from '../overlap/overlap.module';
import { RegenerateController } from './regenerate.controller';
import { RegenerateService } from './regenerate.service';

@Module({
  imports: [AiModule, OverlapModule],
  controllers: [RegenerateController],
  providers: [RegenerateService],
  exports: [RegenerateService],
})
export class RegenerateModule {}
