jest.mock('pdf-parse', () => jest.fn());
jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn(),
  extractText: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import pdfParse from 'pdf-parse';
import { getDocumentProxy, extractText } from 'unpdf';
import { LIMITS } from '@smart-backlog/shared';
import { PdfService } from '../../src/pdf/pdf.service';
import { PdfError } from '../../src/pdf/pdf.validator';

const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;
const mockGetDocumentProxy = getDocumentProxy as jest.MockedFunction<typeof getDocumentProxy>;
const mockExtractText = extractText as jest.MockedFunction<typeof extractText>;

const DUMMY = Buffer.from('dummy');
// Text long enough to clear the IMAGE_PDF_TEXT_THRESHOLD (50 chars)
const SHORT_VALID = 'A '.repeat(30).trim(); // 59 chars

describe('PdfService', () => {
  let service: PdfService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();
    service = module.get<PdfService>(PdfService);
  });

  beforeEach(() => jest.clearAllMocks());

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('extract — happy path', () => {
    it('returns text, wordCount, segments, and segmentCount from pdf-parse', async () => {
      mockPdfParse.mockResolvedValueOnce({ text: SHORT_VALID } as any);

      const result = await service.extract(DUMMY);

      expect(result.text).toBe(SHORT_VALID);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.segmentCount).toBe(1);
      expect(result.segments).toHaveLength(1);
    });

    it('falls back to unpdf when pdf-parse throws', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('corrupted xref'));
      mockGetDocumentProxy.mockResolvedValueOnce({} as any);
      mockExtractText.mockResolvedValueOnce({ text: SHORT_VALID, totalPages: 1 } as any);

      const result = await service.extract(DUMMY);

      expect(result.text).toBe(SHORT_VALID);
      expect(mockGetDocumentProxy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  describe('extract — error paths', () => {
    it('throws PDF_EXTRACT_FAILED when both parsers fail', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('pdf-parse fail'));
      mockGetDocumentProxy.mockRejectedValueOnce(new Error('unpdf fail'));

      await expect(service.extract(DUMMY)).rejects.toMatchObject({
        code: 'PDF_EXTRACT_FAILED',
      });
    });

    it('throws PDF_IMAGE_ONLY when extracted text is below IMAGE_PDF_TEXT_THRESHOLD', async () => {
      // 'Img' → 3 chars < threshold of 50
      mockPdfParse.mockResolvedValueOnce({ text: 'Img' } as any);

      await expect(service.extract(DUMMY)).rejects.toMatchObject({
        code: 'PDF_IMAGE_ONLY',
      });
    });

    it('throws PDF_IMAGE_ONLY when pdf-parse returns empty string', async () => {
      mockPdfParse.mockResolvedValueOnce({ text: '' } as any);

      await expect(service.extract(DUMMY)).rejects.toMatchObject({
        code: 'PDF_IMAGE_ONLY',
      });
    });

    it('thrown error is an instance of PdfError', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('x'));
      mockGetDocumentProxy.mockRejectedValueOnce(new Error('x'));

      await expect(service.extract(DUMMY)).rejects.toBeInstanceOf(PdfError);
    });
  });

  // ── Segmentation ──────────────────────────────────────────────────────────

  describe('extract — segmentation', () => {
    it('keeps text in one segment when word count is within MAX_WORD_COUNT', async () => {
      const text = Array(100).fill('word').join(' ');
      mockPdfParse.mockResolvedValueOnce({ text } as any);

      const result = await service.extract(DUMMY);

      expect(result.segmentCount).toBe(1);
      expect(result.wordCount).toBe(100);
    });

    it('splits into two segments when a paragraph pushes total over MAX_WORD_COUNT', async () => {
      const para1 = Array(LIMITS.MAX_WORD_COUNT).fill('word').join(' ');
      const para2 = 'overflow paragraph here';
      const longText = `${para1}\n\n${para2}`;
      mockPdfParse.mockResolvedValueOnce({ text: longText } as any);

      const result = await service.extract(DUMMY);

      expect(result.segmentCount).toBe(2);
      expect(result.segments[0]).toBe(para1);
      expect(result.segments[1]).toBe(para2);
    });

    it('never splits a paragraph mid-text — each segment boundary aligns to paragraph end', async () => {
      // Three paragraphs: first two are just under the limit together, third overflows
      const half = Array(Math.floor(LIMITS.MAX_WORD_COUNT / 2)).fill('x').join(' ');
      const overflow = Array(LIMITS.MAX_WORD_COUNT).fill('y').join(' ');
      const text = `${half}\n\n${half}\n\n${overflow}`;
      mockPdfParse.mockResolvedValueOnce({ text } as any);

      const result = await service.extract(DUMMY);

      expect(result.segmentCount).toBe(2);
      // First segment holds both half-paragraphs concatenated
      expect(result.segments[0]).toBe(`${half}\n\n${half}`);
      expect(result.segments[1]).toBe(overflow);
    });
  });
});
