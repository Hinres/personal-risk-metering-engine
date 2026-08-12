import { AppDataSource } from '../../src/config/database';
import { ComplianceFilter } from '../../src/services/compliance.service';

jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity?.name === 'User' || entity?.name?.includes('User')) {
        return {
          findOne: jest.fn().mockResolvedValue({
            user_id: 'u1',
            preferences: { risk_tolerance: 'aggressive' },
          }),
        };
      }
      return {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((data) => ({ ...data, optimization_id: 'opt1' })),
        save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      };
    }),
  },
}));

describe('ComplianceFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndFilter', () => {
    it('should pass clean suggestions without keywords', () => {
      const result = ComplianceFilter.checkAndFilter({
        suggestions: [
          { title: '增加分散度', description: '建议关注组合分散化程度' },
        ],
      });
      expect(result.hasInvestmentKeywords).toBe(false);
      expect(result.filteredSuggestions.length).toBe(1);
      expect(result.filteredSuggestions[0].title).toBe('增加分散度');
    });

    it('should detect and filter investment keywords', () => {
      const result = ComplianceFilter.checkAndFilter({
        suggestions: [
          { title: '买入推荐', description: '强烈建议买入该股票' },
        ],
      });
      expect(result.hasInvestmentKeywords).toBe(true);
      expect(result.filteredSuggestions[0].title).toBe('分散化风险提示');
      expect(result.complianceNote).toContain('检测到投资建议关键词');
    });

    it('should handle mixed suggestions', () => {
      const result = ComplianceFilter.checkAndFilter({
        suggestions: [
          { title: '正常建议', description: '建议关注风险' },
          { title: '卖出清仓', description: '建议立即清仓' },
        ],
      });
      expect(result.hasInvestmentKeywords).toBe(true);
      expect(result.filteredSuggestions[0].title).toBe('正常建议');
      expect(result.filteredSuggestions[1].title).toBe('分散化风险提示');
    });

    it('should handle empty suggestions', () => {
      const result = ComplianceFilter.checkAndFilter({});
      expect(result.hasInvestmentKeywords).toBe(false);
      expect(result.filteredSuggestions.length).toBe(0);
    });

    it('should detect keywords in portfolio fields', () => {
      const result = ComplianceFilter.checkAndFilter({
        currentPortfolio: { name: '推荐买入', description: '强烈建议买入该股票' },
        suggestions: [],
      });
      expect(result.hasInvestmentKeywords).toBe(true);
      expect(result.complianceNote).toContain('检测到投资建议关键词');
    });

    it('should detect keywords in backtest', () => {
      const result = ComplianceFilter.checkAndFilter({
        backtest: { period: '1年', sharpe: 1.5, note: '建议立即清仓' },
        suggestions: [],
      });
      expect(result.hasInvestmentKeywords).toBe(true);
      expect(result.complianceNote).toContain('检测到投资建议关键词');
    });
  });

  describe('mapRiskToleranceToConstraints', () => {
    it('should map conservative', () => {
      const constraints = ComplianceFilter.mapRiskToleranceToConstraints('conservative');
      expect(constraints.max_sector_exposure).toBe(0.20);
      expect(constraints.max_single_holding).toBe(0.15);
      expect(constraints.allow_short).toBe(false);
    });

    it('should map moderate', () => {
      const constraints = ComplianceFilter.mapRiskToleranceToConstraints('moderate');
      expect(constraints.max_sector_exposure).toBe(0.30);
      expect(constraints.max_single_holding).toBe(0.20);
    });

    it('should map aggressive', () => {
      const constraints = ComplianceFilter.mapRiskToleranceToConstraints('aggressive');
      expect(constraints.max_sector_exposure).toBe(0.40);
      expect(constraints.max_single_holding).toBe(0.30);
    });

    it('should default to moderate for unknown', () => {
      const constraints = ComplianceFilter.mapRiskToleranceToConstraints('unknown');
      expect(constraints.max_sector_exposure).toBe(0.30);
      expect(constraints.user_risk_tolerance).toBe('moderate');
    });
  });

  describe('wrapResult', () => {
    it('should wrap expected return as confidence interval', () => {
      const result = ComplianceFilter.wrapResult(
        {
          currentPortfolio: { expected_return: 0.08 },
          optimizedPortfolio: { expected_return: 0.10 },
        },
        'user-123',
        'risk_parity',
        {
          hasInvestmentKeywords: false,
          filteredSuggestions: [{ title: '测试' }],
          complianceNote: '无关键词',
        },
        ComplianceFilter.mapRiskToleranceToConstraints('moderate')
      );
      expect(result.disclaimer).toBeDefined();
      expect(result.current_portfolio.expected_return).toHaveProperty('low');
      expect(result.current_portfolio.expected_return).toHaveProperty('high');
      expect(result.current_portfolio.expected_return).toHaveProperty('confidence');
    });

    it('should include backtest disclaimer', () => {
      const result = ComplianceFilter.wrapResult(
        {
          backtest: { period: '1年', sharpe: 1.5 },
        },
        'user-123',
        'mean_variance',
        {
          hasInvestmentKeywords: false,
          filteredSuggestions: [],
          complianceNote: '无关键词',
        },
        ComplianceFilter.mapRiskToleranceToConstraints('moderate')
      );
      expect(result.backtest).toHaveProperty('disclaimer');
    });
  });

  describe('saveResult', () => {
    it('should save optimization result', async () => {
      const result = await ComplianceFilter.saveResult(
        'u1',
        'p1',
        'mean_variance',
        {
          currentPortfolio: { expected_return: 0.08 },
          optimizedPortfolio: { expected_return: 0.10 },
        },
        {},
        {
          hasInvestmentKeywords: false,
          filteredSuggestions: [{ title: '测试' }],
          complianceNote: '无关键词',
        },
        ComplianceFilter.mapRiskToleranceToConstraints('moderate')
      );
      expect(result).toHaveProperty('optimization_id');
      expect(result.status).toBe('completed');
    });
  });

  describe('getUserRiskTolerance', () => {
    it('should return user risk tolerance', async () => {
      jest.doMock('../../src/config/database', () => ({
        AppDataSource: {
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue({
              user_id: 'u1',
              preferences: { risk_tolerance: 'aggressive' },
            }),
          }),
        },
      }));
      const { ComplianceFilter: CF } = await import('../../src/services/compliance.service');
      const result = await CF.getUserRiskTolerance('u1');
      expect(result).toBe('aggressive');
      jest.dontMock('../../src/config/database');
    });

    it('should default to moderate', async () => {
      jest.doMock('../../src/config/database', () => ({
        AppDataSource: {
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue(null),
          }),
        },
      }));
      const { ComplianceFilter: CF } = await import('../../src/services/compliance.service');
      const result = await CF.getUserRiskTolerance('u1');
      expect(result).toBe('moderate');
      jest.dontMock('../../src/config/database');
    });
  });
});
