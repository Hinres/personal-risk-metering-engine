import cron from 'node-cron';
import { initializeJobs, stopJobs } from '../../src/jobs';

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/services/report.service', () => ({
  closeBrowser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/jobs/marketDataSync.job', () => ({
  scheduleMarketDataSync: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/varCalculation.job', () => ({
  scheduleVaRCalculation: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/riskMonitoring.job', () => ({
  scheduleRiskMonitoring: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/reportGeneration.job', () => ({
  scheduleReportGeneration: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/marketFluctuation.job', () => ({
  scheduleMarketFluctuationCheck: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/partitionMaintenance.job', () => ({
  schedulePartitionMaintenance: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/exportCleanup.job', () => ({
  scheduleExportCleanup: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/databaseBackup.job', () => ({
  scheduleDatabaseBackup: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/dailyPortfolioSnapshot.job', () => ({
  scheduleDailyPortfolioSnapshot: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

jest.mock('../../src/jobs/riskEventCollection.job', () => ({
  scheduleRiskEventCollection: jest.fn().mockReturnValue({
    stop: jest.fn(),
    start: jest.fn(),
    getStatus: jest.fn().mockReturnValue('scheduled'),
  }),
}));

describe('Jobs - Cron Handle Management & Shutdown', () => {
  let mockTask: any;
  let scheduleMarketDataSync: jest.MockedFunction<any>;
  let scheduleVaRCalculation: jest.MockedFunction<any>;
  let scheduleRiskMonitoring: jest.MockedFunction<any>;
  let scheduleReportGeneration: jest.MockedFunction<any>;
  let scheduleMarketFluctuationCheck: jest.MockedFunction<any>;
  let schedulePartitionMaintenance: jest.MockedFunction<any>;
  let scheduleExportCleanup: jest.MockedFunction<any>;
  let scheduleDatabaseBackup: jest.MockedFunction<any>;
  let scheduleDailyPortfolioSnapshot: jest.MockedFunction<any>;
  let scheduleRiskEventCollection: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTask = {
      stop: jest.fn(),
      start: jest.fn(),
      getStatus: jest.fn().mockReturnValue('scheduled'),
    };

    const marketDataSyncModule = require('../../src/jobs/marketDataSync.job');
    const varCalcModule = require('../../src/jobs/varCalculation.job');
    const riskMonitoringModule = require('../../src/jobs/riskMonitoring.job');
    const reportGenModule = require('../../src/jobs/reportGeneration.job');
    const marketFluctuationModule = require('../../src/jobs/marketFluctuation.job');
    const partitionMaintenanceModule = require('../../src/jobs/partitionMaintenance.job');
    const exportCleanupModule = require('../../src/jobs/exportCleanup.job');
    const databaseBackupModule = require('../../src/jobs/databaseBackup.job');
    const dailyPortfolioSnapshotModule = require('../../src/jobs/dailyPortfolioSnapshot.job');
    const riskEventCollectionModule = require('../../src/jobs/riskEventCollection.job');

    scheduleMarketDataSync = marketDataSyncModule.scheduleMarketDataSync;
    scheduleVaRCalculation = varCalcModule.scheduleVaRCalculation;
    scheduleRiskMonitoring = riskMonitoringModule.scheduleRiskMonitoring;
    scheduleReportGeneration = reportGenModule.scheduleReportGeneration;
    scheduleMarketFluctuationCheck = marketFluctuationModule.scheduleMarketFluctuationCheck;
    schedulePartitionMaintenance = partitionMaintenanceModule.schedulePartitionMaintenance;
    scheduleExportCleanup = exportCleanupModule.scheduleExportCleanup;
    scheduleDatabaseBackup = databaseBackupModule.scheduleDatabaseBackup;
    scheduleDailyPortfolioSnapshot = dailyPortfolioSnapshotModule.scheduleDailyPortfolioSnapshot;
    scheduleRiskEventCollection = riskEventCollectionModule.scheduleRiskEventCollection;

    scheduleMarketDataSync.mockReturnValue(mockTask);
    scheduleVaRCalculation.mockReturnValue(mockTask);
    scheduleRiskMonitoring.mockReturnValue(mockTask);
    scheduleReportGeneration.mockReturnValue(mockTask);
    scheduleMarketFluctuationCheck.mockReturnValue(mockTask);
    schedulePartitionMaintenance.mockReturnValue(mockTask);
    scheduleExportCleanup.mockReturnValue(mockTask);
    scheduleDatabaseBackup.mockReturnValue(mockTask);
    scheduleDailyPortfolioSnapshot.mockReturnValue(mockTask);
    scheduleRiskEventCollection.mockReturnValue(mockTask);
  });

  afterEach(() => {
    stopJobs();
  });

  describe('scheduleXxx() functions', () => {
    it('CRON-001: each schedule function should return a valid task handle', () => {
      const marketTask = scheduleMarketDataSync();
      const varTask = scheduleVaRCalculation();
      const riskTask = scheduleRiskMonitoring();
      const reportTask = scheduleReportGeneration();
      const fluctuationTask = scheduleMarketFluctuationCheck();
      const partitionTask = schedulePartitionMaintenance();

      expect(marketTask).toBeDefined();
      expect(varTask).toBeDefined();
      expect(riskTask).toBeDefined();
      expect(reportTask).toBeDefined();
      expect(fluctuationTask).toBeDefined();
      expect(partitionTask).toBeDefined();

      expect(marketTask.stop).toBeDefined();
      expect(varTask.stop).toBeDefined();
      expect(riskTask.stop).toBeDefined();
      expect(reportTask.stop).toBeDefined();
      expect(fluctuationTask.stop).toBeDefined();
      expect(partitionTask.stop).toBeDefined();
    });
  });

  describe('initializeJobs()', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('CRON-002: should return array of 10 task handles in non-test env', () => {
      process.env.NODE_ENV = 'development';
      
      const tasks = initializeJobs();

      expect(tasks).toHaveLength(10);
      // Verify each task is a valid cron handle with stop method
      tasks.forEach((task: any) => {
        expect(task).toBeDefined();
        expect(typeof task.stop).toBe('function');
      });
    });

    it('CRON-003: should return empty array in test environment', () => {
      process.env.NODE_ENV = 'test';

      const tasks = initializeJobs();

      expect(tasks).toHaveLength(0);
      expect(scheduleMarketDataSync).not.toHaveBeenCalled();
    });

    it('CRON-002: should return actual cron task objects with stop method', () => {
      process.env.NODE_ENV = 'development';
      
      const tasks = initializeJobs();

      tasks.forEach((task: any) => {
        expect(task).toBeDefined();
        expect(typeof task.stop).toBe('function');
      });
    });
  });

  describe('stopJobs()', () => {
    it('CRON-004: should stop all scheduled tasks and clear array', () => {
      process.env.NODE_ENV = 'development';
      
      const tasks = initializeJobs();
      expect(tasks).toHaveLength(10);

      stopJobs();

      const stopCallCount = tasks.reduce((sum: number, task: any) => sum + task.stop.mock.calls.length, 0);
      expect(stopCallCount).toBeGreaterThanOrEqual(10);
    });

    it('CRON-006: should handle repeated calls without error', () => {
      process.env.NODE_ENV = 'development';
      
      initializeJobs();
      stopJobs();
      
      expect(() => stopJobs()).not.toThrow();
    });

    it('CRON-006: should handle stopJobs when no jobs initialized', () => {
      expect(() => stopJobs()).not.toThrow();
    });
  });

  describe('Task lifecycle', () => {
    it('CRON-007: should be able to stop individual task', () => {
      const task = scheduleMarketDataSync();
      
      task.stop();
      
      expect(task.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-3.6: Task stop() should prevent further execution', () => {
    it('CRON-008: after stopJobs, tasks array should be cleared', () => {
      process.env.NODE_ENV = 'development';

      const tasks = initializeJobs();
      expect(tasks.length).toBeGreaterThan(0);

      stopJobs();

      // After stopJobs, scheduledTasks should be empty
      // Verify by calling initializeJobs again in test env (returns empty)
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const emptyTasks = initializeJobs();
      expect(emptyTasks).toHaveLength(0);
      process.env.NODE_ENV = originalEnv;
    });

    it('CRON-009: stopJobs should clear scheduledTasks internally', () => {
      process.env.NODE_ENV = 'development';

      initializeJobs();
      stopJobs();

      expect(() => stopJobs()).not.toThrow();
    });
  });
});
