import { AppDataSource, initializeDatabase } from '../../src/config/database';
import { runNamingAlignmentMigration } from '../../src/database/migrations/002-naming-alignment-migration';

// Mock puppeteer to avoid ES module issues in jest
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

describe('NamingAlignmentMigration — missing old tables', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await initializeDatabase();
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('should not throw when old tables (operation_logs etc.) are missing', async () => {
    const runner = AppDataSource.createQueryRunner();
    await runner.connect();
    try {
      // Ensure the legacy tables do not exist on the fresh test database
      for (const table of ['alert_records', 'operation_logs', 'risk_reports', 'risk_monitors']) {
        await runner.query(`DROP TABLE IF EXISTS ${table}`);
      }

      await expect(runNamingAlignmentMigration(runner)).resolves.not.toThrow();

      // monitor_status view should be recreated/updated
      const views = await runner.query(
        "SELECT name FROM sqlite_master WHERE type='view' AND name='monitor_status'"
      );
      expect(views.length).toBe(1);
    } finally {
      await runner.release();
    }
  });
});
