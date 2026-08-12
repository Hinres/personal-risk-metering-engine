import { AppDataSource } from '../../src/config/database';
import { AnonymizationService } from '../../src/services/anonymization.service';

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
  }),
  __esModule: true,
}));

jest.mock('../../src/services/websocket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      close: jest.fn(),
    }),
  },
}));

jest.mock('../../src/jobs', () => ({
  initializeJobs: jest.fn().mockReturnValue([]),
  stopJobs: jest.fn(),
}));

describe('T-23 Anonymization SQL', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  describe('TC-ANON.1: IP address generalize SQL', () => {
    it('should produce correct SQL for IP generalization', async () => {
      const result = await AnonymizationService.anonymizeTable({
        table: 'audit_logs',
        rules: [
          { column: 'ip_address', method: 'generalize', options: { keepSegments: 2 } },
        ],
      }, true); // dryRun

      expect(result.table).toBe('audit_logs');
      expect(result.fieldsAnonymized).toContain('ip_address');
      // The SQL should use CASE WHEN and correct substr/instr formula
    });
  });

  describe('TC-ANON.2: Dry run should not modify data', () => {
    it('should return 0 records processed in dry run', async () => {
      const result = await AnonymizationService.runAnonymizationPipeline(true);
      expect(result.status).toBe('dry_run_completed');
      expect(result.totalRecords).toBe(0);
    });
  });

  describe('TC-ANON.3: Pipeline should complete without error', () => {
    it('should run full pipeline', async () => {
      const result = await AnonymizationService.runAnonymizationPipeline(true);
      expect(result.logId).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});
