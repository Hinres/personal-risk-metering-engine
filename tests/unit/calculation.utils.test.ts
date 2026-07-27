/**
 * [PRME-CALC-001] 计算引擎数学工具单元测试
 * 测试范围: percentile, mean, stdDev, sampleStdDev, covarianceMatrix, matMul, matVecMul, dotProduct, correlationMatrix, normInv, matrixInverse, matrixCondition
 * 最后更新: 2026-06-28
 */
import {
  percentile, mean, stdDev, sampleStdDev, covarianceMatrix, matMul, matVecMul, dotProduct, correlationMatrix, normInv, matrixInverse, matrixCondition
} from '../../src/calculation/utils';

describe('calculation/utils', () => {
  describe('percentile', () => {
    it('should handle empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });
    it('should calculate percentile', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });
    it('should return highest element when p=100 (upper bound)', () => {
      expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
    });
    it('should clamp to highest element when p exceeds 100', () => {
      expect(percentile([1, 2, 3, 4, 5], 101)).toBe(5);
    });
  });

  describe('mean', () => {
    it('should handle empty array', () => {
      expect(mean([])).toBe(0);
    });
    it('should calculate mean', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });
  });

  describe('stdDev', () => {
    it('should handle empty array', () => {
      expect(stdDev([])).toBe(0);
    });
    it('should calculate standard deviation', () => {
      const result = stdDev([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.414, 2);
    });
  });

  describe('sampleStdDev', () => {
    it('should handle array with <= 1 element', () => {
      expect(sampleStdDev([])).toBe(0);
      expect(sampleStdDev([1])).toBe(0);
    });
    it('should calculate sample standard deviation', () => {
      const result = sampleStdDev([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.581, 2);
    });
  });

  describe('covarianceMatrix', () => {
    it('should handle empty array', () => {
      expect(covarianceMatrix([])).toEqual([]);
    });
    it('should calculate covariance matrix', () => {
      const returns = [[1, 2], [2, 3], [3, 4]];
      const result = covarianceMatrix(returns);
      expect(result.length).toBe(2);
      expect(result[0].length).toBe(2);
    });
  });

  describe('matMul', () => {
    it('should multiply matrices', () => {
      const a = [[1, 2], [3, 4]];
      const b = [[5, 6], [7, 8]];
      const result = matMul(a, b);
      expect(result).toEqual([[19, 22], [43, 50]]);
    });
  });

  describe('matVecMul', () => {
    it('should multiply matrix and vector', () => {
      const mat = [[1, 2], [3, 4]];
      const vec = [5, 6];
      const result = matVecMul(mat, vec);
      expect(result).toEqual([17, 39]);
    });
  });

  describe('dotProduct', () => {
    it('should calculate dot product', () => {
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
    });
  });

  describe('correlationMatrix', () => {
    it('should handle zero variance column (std=0)', () => {
      const returns = [[1, 2], [1, 3], [1, 4]];
      const result = correlationMatrix(returns);
      // Column 0 has zero variance
      expect(result[0][0]).toBe(1);
      expect(result[0][1]).toBe(0);
      expect(result[1][0]).toBe(0);
    });
  });

  describe('normInv', () => {
    it('should handle p <= 0', () => {
      expect(normInv(0)).toBe(-Infinity);
      expect(normInv(-0.1)).toBe(-Infinity);
    });
    it('should handle p >= 1', () => {
      expect(normInv(1)).toBe(Infinity);
      expect(normInv(1.1)).toBe(Infinity);
    });
    it('should handle p = 0.5', () => {
      expect(normInv(0.5)).toBeCloseTo(0, 3);
    });
    it('should handle low p', () => {
      expect(normInv(0.01)).toBeLessThan(-2);
    });
    it('should handle high p', () => {
      expect(normInv(0.99)).toBeGreaterThan(2);
    });
  });

  describe('matrixInverse', () => {
    it('should invert identity matrix', () => {
      const mat = [[1, 0], [0, 1]];
      const result = matrixInverse(mat);
      expect(result[0][0]).toBeCloseTo(1, 5);
      expect(result[1][1]).toBeCloseTo(1, 5);
    });
    it('should invert regular matrix', () => {
      const mat = [[4, 7], [2, 6]];
      const result = matrixInverse(mat);
      const identity = matMul(mat, result);
      expect(identity[0][0]).toBeCloseTo(1, 3);
      expect(identity[1][1]).toBeCloseTo(1, 3);
    });
    it('should throw for singular matrix', () => {
      const mat = [[1, 2], [2, 4]];
      expect(() => matrixInverse(mat)).toThrow('Matrix is singular');
    });
  });

  describe('matrixCondition', () => {
    it('should calculate condition number', () => {
      const mat = [[1, 0], [0, 1]];
      expect(matrixCondition(mat)).toBe(1);
    });
    it('should return Infinity for singular matrix', () => {
      const mat = [[1, 2], [2, 4]];
      expect(matrixCondition(mat)).toBe(Infinity);
    });
  });
});
