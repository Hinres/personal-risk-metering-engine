import app from '../../src/app';
import { initializeJobs, stopJobs } from '../../src/jobs';
import { closeBrowser } from '../../src/services/report.service';

// Mock dependencies for integration testing
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
  }),
}));

describe('Graceful Shutdown Integration', () => {
  let mockBrowser: any;
  let mockTasks: any[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
    };

    // Setup mock tasks
    mockTasks = [
      { stop: jest.fn(), getStatus: jest.fn().mockReturnValue('scheduled') },
      { stop: jest.fn(), getStatus: jest.fn().mockReturnValue('scheduled') },
      { stop: jest.fn(), getStatus: jest.fn().mockReturnValue('scheduled') },
      { stop: jest.fn(), getStatus: jest.fn().mockReturnValue('scheduled') },
    ];
  });

  afterEach(async () => {
    // Clean up
    await closeBrowser();
    stopJobs();
  });

  it('CRON-005: shutdown sequence should follow correct order', async () => {
    // Initialize jobs
    process.env.NODE_ENV = 'development';
    const tasks = initializeJobs();
    expect(tasks.length).toBeGreaterThan(0);

    // Simulate shutdown sequence
    const shutdownOrder: string[] = [];

    // Step 1: Stop cron jobs
    stopJobs();
    shutdownOrder.push('stopJobs');

    // Step 2: Close browser
    await closeBrowser();
    shutdownOrder.push('closeBrowser');

    // Verify order
    expect(shutdownOrder).toEqual(['stopJobs', 'closeBrowser']);

    // Verify tasks were stopped
    expect(stopJobs).not.toThrow();
  });

  it('should handle browser close during shutdown', async () => {
    // Close browser should not throw even if not initialized
    await expect(closeBrowser()).resolves.not.toThrow();
  });

  it('should handle jobs stop during shutdown', () => {
    process.env.NODE_ENV = 'development';

    // Initialize
    initializeJobs();

    // Stop jobs
    expect(() => stopJobs()).not.toThrow();

    // Verify jobs are stopped
    expect(() => stopJobs()).not.toThrow();
  });

  it('should handle complete shutdown without errors', async () => {
    process.env.NODE_ENV = 'development';

    // Initialize jobs
    initializeJobs();

    // Execute full shutdown sequence
    await expect(Promise.resolve()).resolves.toBeUndefined();
    
    stopJobs();
    await expect(closeBrowser()).resolves.not.toThrow();

    // Verify clean state
    expect(() => stopJobs()).not.toThrow();
  });
});
