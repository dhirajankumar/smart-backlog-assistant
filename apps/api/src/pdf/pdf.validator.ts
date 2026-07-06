import { LIMITS } from '@smart-backlog/shared';

export class PdfError extends Error {
  constructor(
    public readonly code: 'PDF_EXTRACT_FAILED' | 'PDF_IMAGE_ONLY' | 'PDF_TOO_LARGE',
    message: string,
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

export function validateFileSize(buffer: Buffer): void {
  if (buffer.byteLength > LIMITS.MAX_PDF_SIZE_BYTES) {
    throw new PdfError('PDF_TOO_LARGE', `File exceeds the ${LIMITS.MAX_PDF_SIZE_BYTES} byte limit`);
  }
}
