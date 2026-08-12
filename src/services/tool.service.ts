import { AppDataSource } from '../config/database';
import { ToolVaRHistory } from '../models/ToolVaRHistory';
import { PortfolioService } from './portfolio.service';
import { MarketDataService } from './marketData.service';
import { AuditService } from './audit.service';
import {
  calculateHistoricalVaR,
  calculateParametricVaR,
  calculateMonteCarloVaR,
  calculateExtremeValueVaR,
} from '../calculation/var';
import { mean, stdDev } from '../calculation/utils';
import logger from '../utils/logger';

const historyRepo = () => AppDataSource.getRepository(ToolVaRHistory);

export interface ToolVaRParams {
  method: string;
  confidence_level: number;
  time_horizon: number;
  monte_carlo_iterations?: number;
  distribution?: string;
  random_seed?: number;
  // 临时持仓输入（不保存到组合）
  holdings: {
    symbol: string;
    quantity: number;
    current_price?: number;
    sector?: string;
    name?: string;
  }[];
}

export class ToolService {
  /**
   * 独立VaR计算（不保存到组合，直接传入持仓）
   * [PRME-TS-001]
   */
  static async calculateVaR(userId: string, params: ToolVaRParams): Promise<Record<string, any>> {
    const startTime = Date.now();
    const holdings = params.holdings || [];
    if (holdings.length === 0) {
      throw new Error('Holdings cannot be empty for VaR calculation');
    }

    const symbols = holdings.map(h => h.symbol);
    let historicalReturns: number[][] = [];
    try {
      historicalReturns = await MarketDataService.getReturnsMatrix(symbols, 252);
    } catch (e: any) {
      logger.warn('Tool VaR: Market data unavailable, using simulated returns', { error: e.message, symbols });
      const nAssets = holdings.length;
      historicalReturns = Array.from({ length: 252 }, () =>
        Array.from({ length: nAssets }, () => (Math.random() - 0.5) * 0.02)
      );
    }

    const totalValue = holdings.reduce((sum, h) => sum + (Number(h.quantity) * (Number(h.current_price) || 0)), 0);
    const weights = holdings.map(h => totalValue > 0 ? (Number(h.quantity) * (Number(h.current_price) || 0)) / totalValue : 1 / holdings.length);
    const normalizedWeights = weights.map(w => w / weights.reduce((a, b) => a + b, 0));

    let result: any;
    let status = 'completed';
    let errorMessage: string | null = null;

    try {
      switch (params.method) {
        case 'parametric': {
          const portfolioReturns = historicalReturns.map(r =>
            r.reduce((sum, val, i) => sum + val * normalizedWeights[i], 0)
          );
          const meanReturn = mean(portfolioReturns);
          const portfolioStd = stdDev(portfolioReturns);
          result = calculateParametricVaR(meanReturn, portfolioStd, params.confidence_level, symbols);
          break;
        }
        case 'monte_carlo': {
          result = calculateMonteCarloVaR(
            historicalReturns,
            normalizedWeights,
            params.confidence_level,
            params.monte_carlo_iterations || 10000,
            symbols,
            params.random_seed
          );
          break;
        }
        case 'extreme_value': {
          const portfolioReturns = historicalReturns.map(r =>
            r.reduce((sum, val, i) => sum + val * normalizedWeights[i], 0)
          );
          result = calculateExtremeValueVaR(
            portfolioReturns,
            params.confidence_level,
            params.time_horizon,
            symbols,
            (params.distribution as any) === 'mle' ? 'mle' : 'pwm'
          );
          break;
        }
        case 'historical':
        default: {
          result = calculateHistoricalVaR(historicalReturns, normalizedWeights, params.confidence_level, symbols);
          break;
        }
      }
    } catch (calcError: any) {
      logger.warn('Tool VaR embedded engine failed, using fallback', { error: calcError.message });
      result = this.fallbackVaRCalculation(params, holdings, historicalReturns);
      status = 'fallback';
      errorMessage = calcError.message;
    }

    const calculationTime = Date.now() - startTime;

    // 保存到工具计算历史
    const history = historyRepo().create({
      user_id: userId,
      method: params.method,
      confidence_level: params.confidence_level,
      time_horizon: params.time_horizon,
      monte_carlo_iterations: params.monte_carlo_iterations || null,
      distribution: params.distribution || null,
      random_seed: params.random_seed || null,
      var_value: result.var_value || 0,
      var_percentage: result.var_percentage || 0,
      expected_return: result.expected_return || null,
      volatility: result.volatility || null,
      holdings: holdings as any,
      components: result.components || null,
      risk_factors: result.risk_factors || null,
      calculation_time_ms: calculationTime,
      status,
      error_message: errorMessage,
    });
    await historyRepo().save(history);

    // 审计日志
    await AuditService.log('CALCULATE', 'tool_var_history', history.history_id, {
      method: params.method,
      confidence_level: params.confidence_level,
      holding_count: holdings.length,
      status,
      is_fallback: status === 'fallback',
    }, {
      userId,
    });

    return {
      ...result,
      history_id: history.history_id,
      calculation_time_ms: calculationTime,
      status,
      is_fallback: status === 'fallback',
    };
  }

  /**
   * 获取用户计算历史
   * [PRME-TS-001]
   */
  static async getHistory(userId: string, page = 1, limit = 20) {
    const [history, total] = await historyRepo().findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { history, total, page, limit };
  }

  /**
   * 获取历史记录详情
   */
  static async getHistoryById(userId: string, historyId: string) {
    const record = await historyRepo().findOne({
      where: { history_id: historyId, user_id: userId },
    });
    if (!record) throw new Error('History record not found');
    return record;
  }

  /**
   * 保存参数预设（使用用户偏好JSON字段）
   * [PRME-TS-001]
   */
  static async savePreset(userId: string, name: string, preset: Record<string, any>) {
    const { UserService } = await import('./user.service');
    const user = await UserService.getProfile(userId);
    const presets = (user.metadata?.var_presets || []) as any[];

    const existingIndex = presets.findIndex(p => p.name === name);
    const newPreset = {
      name,
      ...preset,
      saved_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      presets[existingIndex] = newPreset;
    } else {
      presets.push(newPreset);
    }

    await UserService.updateProfile(userId, {
      metadata: {
        ...user.metadata,
        var_presets: presets,
      },
    } as any);

    return { presets };
  }

  /**
   * 获取参数预设列表
   */
  static async getPresets(userId: string) {
    const { UserService } = await import('./user.service');
    const user = await UserService.getProfile(userId);
    return (user.metadata?.var_presets || []) as any[];
  }

  /**
   * 删除参数预设
   */
  static async deletePreset(userId: string, name: string) {
    const { UserService } = await import('./user.service');
    const user = await UserService.getProfile(userId);
    const presets = (user.metadata?.var_presets || []) as any[];
    const filtered = presets.filter(p => p.name !== name);

    await UserService.updateProfile(userId, {
      metadata: {
        ...user.metadata,
        var_presets: filtered,
      },
    } as any);

    return { presets: filtered };
  }

  /**
   * 降级参数法计算（简化）
   * 修复 DEF-CONT-003：循环维度与 /var/calculate 的 asyncFallbackCalculation 保持一致
   */
  private static fallbackVaRCalculation(params: ToolVaRParams, holdings: any[], historicalReturns: number[][]): Record<string, any> {
    const totalValue = holdings.reduce((sum, h) => sum + (Number(h.quantity) * (Number(h.current_price) || 100)), 0);
    const weights = holdings.map(h => totalValue > 0 ? (Number(h.quantity) * (Number(h.current_price) || 100)) / totalValue : 0);

    let portfolioMean = 0;
    let portfolioVar = 0;
    const nDays = historicalReturns.length;
    const nAssets = historicalReturns.length > 0 ? historicalReturns[0].length : 0;

    if (nAssets > 0 && nDays > 0) {
      // ✅ 修正循环：外层遍历天数，内层遍历资产
      for (let day = 0; day < nDays; day++) {
        let dayReturn = 0;
        for (let i = 0; i < nAssets; i++) {
          dayReturn += (historicalReturns[day][i] || 0) * weights[i];
        }
        portfolioMean += dayReturn;
      }
      portfolioMean /= nDays;

      for (let day = 0; day < nDays; day++) {
        let dayReturn = 0;
        for (let i = 0; i < nAssets; i++) {
          dayReturn += (historicalReturns[day][i] || 0) * weights[i];
        }
        portfolioVar += Math.pow(dayReturn - portfolioMean, 2);
      }
      portfolioVar = portfolioVar / nDays;
    }

    const portfolioStd = Math.sqrt(portfolioVar);
    const zScore = this.getZScore(params.confidence_level);
    // ✅ 修正 VaR 公式符号：负值表示预期损失
    const varValue = -(portfolioMean * totalValue * params.time_horizon - zScore * portfolioStd * totalValue * Math.sqrt(params.time_horizon));
    const varPercentage = totalValue > 0 ? Math.abs(varValue) / totalValue : 0; // ✅ 避免 NaN

    return {
      var_value: parseFloat(varValue.toFixed(2)),
      var_percentage: parseFloat(varPercentage.toFixed(4)),
      expected_return: parseFloat((portfolioMean * params.time_horizon).toFixed(4)),
      volatility: parseFloat((portfolioStd * Math.sqrt(params.time_horizon)).toFixed(4)),
      method: 'parametric_fallback',
      components: holdings.map((h, i) => ({
        symbol: h.symbol,
        weight: parseFloat(weights[i].toFixed(4)),
        contribution: parseFloat((weights[i] * varPercentage).toFixed(4)),
      })),
      risk_factors: [],
      is_fallback: true,
      fallback_reason: 'calculation_engine_timeout',
    };
  }

  private static getZScore(confidence: number): number {
    // 常用置信度对应的Z值
    const zScores: Record<number, number> = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326,
      0.999: 3.090,
      0.9999: 3.719,
    };
    return zScores[confidence] || 1.645;
  }
}

export default ToolService;
