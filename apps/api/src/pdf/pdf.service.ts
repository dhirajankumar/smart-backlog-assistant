import { Injectable } from '@nestjs/common';

export interface PdfExtractResult {
  text: string;
  wordCount: number;
  segments: string[];
  segmentCount: number;
}

@Injectable()
export class PdfService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extract(_buffer: Buffer): Promise<PdfExtractResult> {
    throw new Error('PdfService.extract not yet implemented — pending T012');
  }
}
