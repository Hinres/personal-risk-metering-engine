/**
 * [PRME-INFRA-006] 基础设施 - date utils 单元测试
 * 测试范围: formatDate, addDays, startOfDay, endOfDay
 * 最后更新: 2026-06-20
 */
import { formatDate, addDays, startOfDay, endOfDay } from '../../src/utils/date';

describe('formatDate', () => {
  const testDate = new Date('2026-06-20 15:30:45');

  it('should format with default format', () => {
    expect(formatDate(testDate)).toBe('2026-06-20 15:30:45');
  });

  it('should format date only', () => {
    expect(formatDate(testDate, 'YYYY-MM-DD')).toBe('2026-06-20');
  });

  it('should format time only', () => {
    expect(formatDate(testDate, 'HH:mm:ss')).toBe('15:30:45');
  });

  it('should handle string input', () => {
    expect(formatDate('2026-01-15 08:05:09')).toBe('2026-01-15 08:05:09');
  });

  it('should pad single digit values', () => {
    const d = new Date('2026-01-02 03:04:05');
    expect(formatDate(d)).toBe('2026-01-02 03:04:05');
  });

  it('should handle custom format with mixed tokens', () => {
    expect(formatDate(testDate, 'YYYY年MM月DD日 HH:mm')).toBe('2026年06月20日 15:30');
  });
});

describe('addDays', () => {
  it('should add days correctly', () => {
    const d = new Date('2026-06-20');
    const result = addDays(d, 5);
    expect(result.toISOString().split('T')[0]).toBe('2026-06-25');
  });

  it('should subtract days correctly', () => {
    const d = new Date('2026-06-20');
    const result = addDays(d, -10);
    expect(result.toISOString().split('T')[0]).toBe('2026-06-10');
  });

  it('should not mutate original', () => {
    const d = new Date('2026-06-20');
    const original = d.toISOString();
    addDays(d, 1);
    expect(d.toISOString()).toBe(original);
  });

  it('should handle month boundary', () => {
    const d = new Date('2026-06-30');
    const result = addDays(d, 1);
    expect(result.toISOString().split('T')[0]).toBe('2026-07-01');
  });
});

describe('startOfDay', () => {
  it('should return start of day', () => {
    const d = new Date('2026-06-20 15:30:45');
    const result = startOfDay(d);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getDate()).toBe(20);
  });

  it('should use current date by default', () => {
    const result = startOfDay();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('should not mutate input', () => {
    const d = new Date('2026-06-20 15:30:45');
    const original = d.getTime();
    startOfDay(d);
    expect(d.getTime()).toBe(original);
  });
});

describe('endOfDay', () => {
  it('should return end of day', () => {
    const d = new Date('2026-06-20 15:30:45');
    const result = endOfDay(d);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
    expect(result.getDate()).toBe(20);
  });

  it('should use current date by default', () => {
    const result = endOfDay();
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });

  it('should not mutate input', () => {
    const d = new Date('2026-06-20 15:30:45');
    const original = d.getTime();
    endOfDay(d);
    expect(d.getTime()).toBe(original);
  });
});
