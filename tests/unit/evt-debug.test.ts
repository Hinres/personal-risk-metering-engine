import { calculateEVT } from '../../src/calculation/evt';

describe('evt coverage debug', () => {
  it('should trigger MLE path', () => {
    const returns = Array.from({ length: 500 }, (_, i) => {
      // 正态分布 + 偶尔的厚尾
      const r = (Math.sin(i) * 0.02) + (Math.random() * 0.01);
      return r > 0.03 ? r * 3 : r;
    });
    
    const result = calculateEVT({
      returns,
      confidenceLevel: 0.95,
      timeHorizon: 1,
      estimationMethod: 'mle',
    });
    
    console.log('MLE result:', JSON.stringify({
      varValue: result.varValue,
      parameters: result.parameters,
      convergenceInfo: result.convergenceInfo,
      diagnostics: result.diagnostics,
      warnings: result.warnings,
      fallbackToMethod: result.fallbackToMethod,
    }, null, 2));
    
    expect(result.varValue).not.toBeNaN();
    // 诊断可能失败导致回退，此时 convergenceInfo 不存在
    if (result.diagnostics.diagnosticsPassed) {
      expect(result.convergenceInfo).toBeDefined();
    }
  });
});
