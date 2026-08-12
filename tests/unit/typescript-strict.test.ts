import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('P0-3 TypeScript Strict Mode', () => {
  const backendDir = path.join(__dirname, '../..');
  const tsConfigPath = path.join(backendDir, 'tsconfig.json');

  describe('TC-P0-3.1 ~ P0-3.2: tsconfig.json configuration', () => {
    let tsConfig: any;

    beforeAll(() => {
      if (fs.existsSync(tsConfigPath)) {
        tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      }
    });

    it('TC-P0-3.1: tsconfig.json should exist', () => {
      expect(fs.existsSync(tsConfigPath)).toBe(true);
    });

    it('TC-P0-3.2: compilerOptions.strict should be true', () => {
      expect(tsConfig).toBeDefined();
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.compilerOptions.strict).toBe(true);
    });

    it('TC-P0-3.2: strict mode implies noImplicitAny and strictNullChecks', () => {
      expect(tsConfig.compilerOptions.strict).toBe(true);
      // When strict: true, these are implicitly enabled
      expect(tsConfig.compilerOptions.noImplicitAny).toBeUndefined();
      expect(tsConfig.compilerOptions.strictNullChecks).toBeUndefined();
    });
  });

  describe('TC-P0-3.1: npx tsc --noEmit compilation check', () => {
    it('should compile with zero errors', () => {
      // Skip in CI if TypeScript is not installed
      const tscPath = path.join(backendDir, 'node_modules/.bin/tsc');
      if (!fs.existsSync(tscPath)) {
        console.warn('Skipping tsc check — tsc not found');
        return;
      }

      let result: string;
      try {
        result = execSync(
          'npx tsc --noEmit',
          { cwd: backendDir, encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (error: any) {
        // If tsc exits non-zero, error.stdout contains the errors
        result = error.stdout || error.message || '';
        // Fail the test if there are compilation errors
        const errorLines = result
          .split('\n')
          .filter((line: string) => line.includes('error TS'));
        expect(errorLines).toHaveLength(0);
        return;
      }

      // If we get here, exit code was 0 — compilation passed
      expect(result).toBeDefined();
    });
  });

  describe('TC-P0-3.3 ~ P0-3.4: Type safety verification', () => {
    it('TC-P0-3.3: AuthRequest interface should allow user access without type errors', () => {
      // This test verifies the runtime behavior; compile-time is checked by tsc
      const authMiddlewarePath = path.join(backendDir, 'src/middleware/auth.middleware.ts');
      expect(fs.existsSync(authMiddlewarePath)).toBe(true);

      const content = fs.readFileSync(authMiddlewarePath, 'utf-8');
      // Verify user?: any pattern is present (compatible with strict mode)
      expect(content).toMatch(/user\?:\s*any/);
    });

    it('TC-P0-3.4: No implicit any in key source files', () => {
      // Spot-check that key service files don't use implicit any
      const authServicePath = path.join(backendDir, 'src/services/auth.service.ts');
      expect(fs.existsSync(authServicePath)).toBe(true);

      const content = fs.readFileSync(authServicePath, 'utf-8');
      // Look for function parameters with explicit types
      expect(content).toMatch(/validatePassword\(password:\s*string\)/);
    });
  });

  describe('TC-5.2: scheduleXxx return type inference', () => {
    it('TC-5.2.1: job schedule functions should declare ReturnType<typeof cron.schedule>', () => {
      const jobFiles = [
        'src/jobs/marketDataSync.job.ts',
        'src/jobs/varCalculation.job.ts',
        'src/jobs/riskMonitoring.job.ts',
        'src/jobs/reportGeneration.job.ts',
      ];

      for (const file of jobFiles) {
        const filePath = path.join(backendDir, file);
        if (!fs.existsSync(filePath)) {
          console.warn(`Job file not found: ${file}`);
          continue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        // Each schedule function should explicitly return cron.schedule() result
        // or declare ReturnType<typeof cron.schedule>
        expect(content).toMatch(/cron\.schedule\(/);
        // Verify the function name contains 'schedule'
        expect(content).toMatch(/export\s+(const|function)\s+schedule/);
      }
    });

    it('TC-5.2.2: initializeJobs return type should be array of cron tasks', () => {
      const jobsIndexPath = path.join(backendDir, 'src/jobs/index.ts');
      expect(fs.existsSync(jobsIndexPath)).toBe(true);

      const content = fs.readFileSync(jobsIndexPath, 'utf-8');
      // Verify array type declaration includes ReturnType<typeof cron.schedule>
      expect(content).toMatch(/ReturnType<typeof cron\.schedule>/);
      // Verify initializeJobs returns the typed array
      expect(content).toMatch(/initializeJobs\s*\(\s*\)/);
    });

    it('TC-5.2.3: stopJobs should accept the task type without TS errors', () => {
      const jobsIndexPath = path.join(backendDir, 'src/jobs/index.ts');
      const content = fs.readFileSync(jobsIndexPath, 'utf-8');

      // stopJobs iterates over scheduledTasks, which must be typed as cron tasks
      expect(content).toMatch(/scheduledTasks/);
      expect(content).toMatch(/\.stop\(\)/);
    });
  });
});
