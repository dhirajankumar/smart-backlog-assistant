import { validateFileSize, PdfError } from '../../src/pdf/pdf.validator';
import { LIMITS } from '@smart-backlog/shared';

describe('validateFileSize', () => {
  it('does not throw for a buffer within the size limit', () => {
    expect(() => validateFileSize(Buffer.alloc(100))).not.toThrow();
  });

  it('does not throw for a buffer exactly at the size limit', () => {
    expect(() => validateFileSize(Buffer.alloc(LIMITS.MAX_PDF_SIZE_BYTES))).not.toThrow();
  });

  it('throws PdfError with code PDF_TOO_LARGE when buffer exceeds limit', () => {
    const oversized = Buffer.alloc(LIMITS.MAX_PDF_SIZE_BYTES + 1);
    expect(() => validateFileSize(oversized)).toThrow(PdfError);
    try {
      validateFileSize(oversized);
    } catch (err) {
      expect((err as PdfError).code).toBe('PDF_TOO_LARGE');
    }
  });
});
