import { Test, TestingModule } from '@nestjs/testing';
import { AnalyseModule } from '../../src/analyse/analyse.module';
import { OverlapService } from '../../src/overlap/overlap.service';
import { LIMITS } from '@smart-backlog/shared';

// Internal token used by @nestjs/platform-express MulterModule to store registered options.
// Value confirmed from node_modules/@nestjs/platform-express/multer/files.constants.js.
const MULTER_MODULE_OPTIONS = 'MULTER_MODULE_OPTIONS';

describe('AnalyseModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AnalyseModule],
    }).compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('compiles and initialises without error', () => {
    expect(moduleRef).toBeDefined();
  });

  it('resolves OverlapService from the imported OverlapModule', () => {
    const service = moduleRef.get(OverlapService, { strict: false });
    expect(service).toBeInstanceOf(OverlapService);
  });

  describe('MulterModule configuration', () => {
    let opts: ReturnType<typeof Object.create>;

    beforeEach(() => {
      opts = moduleRef.get(MULTER_MODULE_OPTIONS, { strict: false });
    });

    it('registers MulterModule options', () => {
      expect(opts).toBeDefined();
    });

    it('caps file size at LIMITS.MAX_PDF_SIZE_BYTES (10 MB)', () => {
      expect(opts.limits.fileSize).toBe(LIMITS.MAX_PDF_SIZE_BYTES);
      expect(LIMITS.MAX_PDF_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('uses in-memory storage (no disk writes)', () => {
      // multer MemoryStorage exposes _handleFile and _removeFile
      expect(typeof opts.storage._handleFile).toBe('function');
      expect(typeof opts.storage._removeFile).toBe('function');
    });
  });
});
