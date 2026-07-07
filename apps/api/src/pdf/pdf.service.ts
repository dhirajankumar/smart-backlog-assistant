import { Injectable } from '@nestjs/common';
import { LIMITS } from '@smart-backlog/shared';
import { PdfError, validateFileSize } from './pdf.validator';
import { AppLogger } from '../common/logger/app-logger.service';

export interface PdfExtractResult {
  text: string;
  wordCount: number;
  segments: string[];
  segmentCount: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function segmentText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text];
  const segments: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords).join(' '));
  }
  return segments;
}

@Injectable()
export class PdfService {
  constructor(private readonly logger: AppLogger) {}

  async extract(buffer: Buffer): Promise<PdfExtractResult> {
    this.logger.log(`PDF parse start — bytes=${buffer.length}`, 'PdfService');
    validateFileSize(buffer);

    let text = '';

    // Primary: pdf-parse
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      text = result.text ?? '';
    } catch {
      // Fallback: unpdf
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { extractText } = require('unpdf');
        const uint8 = new Uint8Array(buffer);
        text = await extractText(uint8);
      } catch (fallbackErr) {
        const err = new PdfError('PDF_EXTRACT_FAILED', `PDF extraction failed: ${String(fallbackErr)}`);
        this.logger.error(`PDF parse failed: ${err.message}`, undefined, 'PdfService');
        throw err;
      }
    }

    if (!text || text.trim().length < LIMITS.IMAGE_PDF_TEXT_THRESHOLD) {
      const err = new PdfError('PDF_IMAGE_ONLY', 'PDF appears to be image-only; no extractable text found');
      this.logger.error(err.message, undefined, 'PdfService');
      throw err;
    }

    const wordCount = countWords(text);
    const segments = segmentText(text.trim(), LIMITS.MAX_WORD_COUNT);
    this.logger.log(`PDF parse complete — words=${wordCount} segments=${segments.length}`, 'PdfService');

    return { text: text.trim(), wordCount, segments, segmentCount: segments.length };
  }
}
