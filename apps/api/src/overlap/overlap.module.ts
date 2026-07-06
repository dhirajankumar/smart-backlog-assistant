import { Module } from '@nestjs/common';
import { OverlapService } from './overlap.service';

@Module({
  providers: [OverlapService],
  exports: [OverlapService],
})
export class OverlapModule {}
