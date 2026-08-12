/**
 * [PRME-PA-003] 优化建议
 * 文件: compliance.service.ts
 * 需求描述: 优化建议功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { OptimizationResult } from '../models/OptimizationResult';
import { User } from '../models/User';
import logger from '../utils/logger';

const optRepo = () => AppDataSource.getRepository(OptimizationResult);
const userRepo = () => AppDataSource.getRepository(User);

// ==================== 投资建议关键词检测 ====================
const INVESTMENT_KEYWORDS = [
  '买入', '卖出', '推荐', 'buy', 'sell', 'recommend',
  '加仓', '减仓', '清仓', 'all-in', 'all in', '抄底',
  '逃顶', '止损', '止盈', 'target price', '目标价',
  '强烈建议', '必须买入', '应该卖出', '立即清仓',
];

const INVESTMENT_REGEX = new RegExp(
  INVESTMENT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gi'
);

// 通用分散化建议模板（替换命中投资建议关键词的内容）
const GENERIC_DIVERSIFICATION_ADVICE = {
  title: '分散化风险提示',
  description: '根据您当前组合的持仓分布，建议关注组合分散化程度。分散化投资有助于降低单一资产或行业的集中度风险。本分析仅供参考，不构成投资建议。',
  type: 'diversification',
  backtest: null,
  generic: true,
};

// ==================== 免责声明模板 ====================
const DISCLAIMER_TEMPLATE = '本分析结果仅供参考，不构成投资建议。投资有风险，入市需谨慎。优化建议基于历史数据回测，历史表现不代表未来收益。请您根据自身风险承受能力做出独立判断。';

const BACKTEST_DISCLAIMER = '回测数据基于历史行情计算，仅供参考，不构成对未来收益的预测或保证。';

interface ComplianceCheckResult {
  hasInvestmentKeywords: boolean;
  filteredSuggestions: Record<string, any>[];
  complianceNote: string;
}

interface OptimizationPayload {
  currentPortfolio?: Record<string, any>;
  optimizedPortfolio?: Record<string, any>;
  suggestions?: Record<string, any>[];
  backtest?: Record<string, any>;
}

interface RiskConstraints {
  max_sector_exposure: number;
  max_single_holding: number;
  allow_short: boolean;
  user_risk_tolerance: string;
}

export class ComplianceFilter {
  /**
   * T-15: 检测投资建议关键词（扩展范围到所有文本字段）
   */
  static checkAndFilter(result: OptimizationPayload): ComplianceCheckResult {
    const suggestions = result.suggestions || [];
    let hasInvestmentKeywords = false;
    const filteredSuggestions: Record<string, any>[] = [];
    const detectedKeywords: string[] = [];

    // 1. 检测 suggestions 数组
    for (const suggestion of suggestions) {
      const textToCheck = JSON.stringify(suggestion);
      const matches = textToCheck.match(INVESTMENT_REGEX);

      if (matches && matches.length > 0) {
        hasInvestmentKeywords = true;
        detectedKeywords.push(...matches);
        filteredSuggestions.push({
          ...GENERIC_DIVERSIFICATION_ADVICE,
          original_title: suggestion.title,
          original_type: suggestion.type,
          filtered_reason: '命中投资建议关键词',
        });
      } else {
        filteredSuggestions.push(suggestion);
      }
    }

    // 2. 检测 currentPortfolio / optimizedPortfolio 的 description / name
    const portfolioFields = [result.currentPortfolio, result.optimizedPortfolio];
    for (const portfolio of portfolioFields) {
      if (portfolio) {
        const text = [portfolio.description, portfolio.name, portfolio.rationale]
          .filter(Boolean)
          .join(' ');
        const matches = text.match(INVESTMENT_REGEX);
        if (matches) {
          hasInvestmentKeywords = true;
          detectedKeywords.push(...matches);
        }
      }
    }

    // 3. 检测 backtest 中的文本字段
    if (result.backtest) {
      const backtestText = JSON.stringify(result.backtest);
      const matches = backtestText.match(INVESTMENT_REGEX);
      if (matches) {
        hasInvestmentKeywords = true;
        detectedKeywords.push(...matches);
      }
    }

    const complianceNote = hasInvestmentKeywords
      ? `检测到投资建议关键词（${Array.from(new Set(detectedKeywords)).join('、')}），已替换为通用分散化建议。`
      : '未检测到投资建议关键词。';

    return {
      hasInvestmentKeywords,
      filteredSuggestions,
      complianceNote,
    };
  }

  /**
   * 将用户风险偏好映射到优化约束
   */
  static mapRiskToleranceToConstraints(riskTolerance: string): RiskConstraints {
    const constraints: Record<string, RiskConstraints> = {
      conservative: {
        max_sector_exposure: 0.20,
        max_single_holding: 0.15,
        allow_short: false,
        user_risk_tolerance: 'conservative',
      },
      moderate: {
        max_sector_exposure: 0.30,
        max_single_holding: 0.20,
        allow_short: false,
        user_risk_tolerance: 'moderate',
      },
      aggressive: {
        max_sector_exposure: 0.40,
        max_single_holding: 0.30,
        allow_short: false,
        user_risk_tolerance: 'aggressive',
      },
    };

    return constraints[riskTolerance] || constraints.moderate;
  }

  /**
   * 包装优化建议响应，添加免责声明、合规处理记录
   */
  static wrapResult(
    result: OptimizationPayload,
    userId: string,
    method: string,
    compliance: ComplianceCheckResult,
    constraints: RiskConstraints
  ): Record<string, any> {
    // 包装预期收益为置信区间
    const current = result.currentPortfolio || {};
    const optimized = result.optimizedPortfolio || {};

    const wrapExpectedReturn = (value: number | undefined) => {
      if (value === undefined || value === null) return null;
      const volatility = 0.05; // 简化：假设年化波动率5%
      const margin = volatility * 1.96; // 95% 置信区间
      return {
        low: parseFloat((value - margin).toFixed(4)),
        high: parseFloat((value + margin).toFixed(4)),
        expected: parseFloat(value.toFixed(4)),
        confidence: 0.95,
        note: '预期收益为基于历史数据的估计区间，实际收益可能偏离。',
      };
    };

    const wrappedCurrent = current
      ? {
          ...current,
          expected_return: wrapExpectedReturn(current.expected_return as number),
        }
      : null;

    const wrappedOptimized = optimized
      ? {
          ...optimized,
          expected_return: wrapExpectedReturn(optimized.expected_return as number),
        }
      : null;

    // 回测数据添加免责声明
    const backtest = result.backtest
      ? {
          ...result.backtest,
          disclaimer: BACKTEST_DISCLAIMER,
        }
      : null;

    // 建议列表添加免责声明
    const suggestions = compliance.filteredSuggestions.map((s) => ({
      ...s,
      disclaimer: DISCLAIMER_TEMPLATE,
    }));

    return {
      disclaimer: DISCLAIMER_TEMPLATE,
      user_consent: {
        consent_type: 'optimization_advice',
        granted: true,
      },
      user_risk_tolerance: constraints.user_risk_tolerance,
      risk_constraints: constraints,
      current_portfolio: wrappedCurrent,
      optimized_portfolio: wrappedOptimized,
      suggestions,
      backtest,
      compliance: {
        has_investment_keywords: compliance.hasInvestmentKeywords,
        note: compliance.complianceNote,
        filtered_at: new Date().toISOString(),
      },
      method,
    };
  }

  /**
   * 保存优化结果到数据库（含合规记录）
   */
  static async saveResult(
    userId: string,
    portfolioId: string,
    method: string,
    rawResult: OptimizationPayload,
    wrappedResult: Record<string, any>,
    compliance: ComplianceCheckResult,
    constraints: RiskConstraints
  ): Promise<OptimizationResult> {
    const opt = optRepo().create({
      user_id: userId,
      portfolio_id: portfolioId,
      method,
      current_portfolio: rawResult.currentPortfolio || null,
      optimized_portfolio: rawResult.optimizedPortfolio || null,
      suggestions: compliance.filteredSuggestions,
      backtest_data: rawResult.backtest || null,
      disclaimer: DISCLAIMER_TEMPLATE,
      compliance_note: compliance.complianceNote,
      risk_constraints: constraints,
      has_investment_keywords: compliance.hasInvestmentKeywords,
      status: 'completed',
    });

    await optRepo().save(opt);
    logger.info('Optimization result saved with compliance record', {
      optimizationId: opt.optimization_id,
      hasKeywords: compliance.hasInvestmentKeywords,
    });

    return opt;
  }

  /**
   * 获取用户风险偏好
   */
  static async getUserRiskTolerance(userId: string): Promise<string> {
    const user = await userRepo().findOne({
      where: { user_id: userId },
      select: ['user_id', 'preferences'],
    });
    return user?.preferences?.risk_tolerance || 'moderate';
  }
}

export default ComplianceFilter;
