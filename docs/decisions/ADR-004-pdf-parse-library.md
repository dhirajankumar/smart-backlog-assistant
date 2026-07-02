# ADR-004: PDF Parsing — pdf-parse with unpdf Fallback

## Status

Accepted — 2026-07-01

## Context

Feature 001 requires the system to extract plain text from uploaded PDF files (FR-001). The
backend runs on Node.js (NestJS). The key constraints are:

- Must run in Node.js with no system-level binary dependencies (required for `pkg` exe packaging)
- Must detect image-only (scanned) PDFs and surface a clear error rather than returning empty
  content silently (FR-018)
- Must handle documents up to 10 MB and up to 5,000 words; larger documents are segmented
- Must produce equivalent output quality to plain-text input (SC-008)

## Decision

Use **`pdf-parse`** as the primary PDF text extractor, with **`unpdf`** as a fallback.

**`pdf-parse`**:
- Wraps Mozilla's PDF.js; handles text-based PDFs reliably across common encodings
- Returns `{ text: string, numpages: number, info: object }` — all needed fields
- Pure Node.js; no native binaries; compatible with `pkg` bundling when listed in
  `pkg.config.json` assets
- Must be used with `runtime = 'nodejs'` (not Edge runtime); NestJS satisfies this by default

**`unpdf`** (fallback):
- Uses a different internal parser; recovers from malformed cross-reference tables and some
  encoding issues that cause `pdf-parse` to throw
- Invoked only when `pdf-parse` throws an exception; result compared for non-empty text

**Image-only PDF detection** (`pdf.service.ts` heuristic):
- If extracted text length (after trim) is < 50 characters for a PDF with > 1 page,
  classify as `PDF_IMAGE_ONLY`
- Return error: "This PDF appears to be image-based and cannot be read. Please paste the
  text manually or use a text-based PDF."

**Long document segmentation** (`pdf.service.ts`):
- If word count of extracted text exceeds `LIMITS.MAX_WORD_COUNT` (5,000 words), split on
  paragraph boundaries into segments of ≤ 5,000 words
- Each `UserStory` carries a `sourceSegment: number` field linking it to its input segment

## Consequences

**Positive**:
- No system dependencies — `pkg` can bundle both libraries as pure JavaScript assets
- Fallback chain maximises compatibility across PDF variants without manual intervention
- Image-only PDF detection prevents silent empty-output failures (constitution Principle IV:
  fail safe, not fail silent)
- Segmentation enables processing of documents exceeding the 5,000-word AI context budget
  without rejecting the upload

**Negative / trade-offs**:
- Neither library handles scanned PDFs with embedded images — this is an accepted limitation
  per the spec (scanned PDFs surface `PDF_IMAGE_ONLY`; OCR is out of scope for MVP1)
- `pdf-parse` has known issues with some AES-encrypted PDFs; these will fall through to
  the `unpdf` fallback or surface as `PDF_EXTRACT_FAILED`
- Paragraph-boundary segmentation may split a requirement across segments in edge cases;
  each story carries a `sourceSegment` reference so reviewers can trace the origin

**Post-MVP**:
- If OCR support for scanned PDFs becomes a requirement, integrate `tesseract.js` (pure
  Node.js OCR) as an additional extraction path triggered on `PDF_IMAGE_ONLY` detection
