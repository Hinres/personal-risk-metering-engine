/**
 * [PRME-v1.3-PA-005] 模板化投资组合
 * 文件: portfolioTemplate.service.ts
 * 需求描述: 组合模板管理与实例化
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { PortfolioTemplate } from '../models/PortfolioTemplate';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { PortfolioService } from './portfolio.service';
import logger from '../utils/logger';
import Decimal from 'decimal.js';

const templateRepo = () => AppDataSource.getRepository(PortfolioTemplate);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export interface TemplateAdjustment {
  symbol: string;
  weight?: number;
}

export class PortfolioTemplateService {
  static async getTemplates(riskLevel?: string, page = 1, pageSize = 20) {
    const where: any = { is_active: true };
    if (riskLevel) where.risk_level = riskLevel;

    const [list, total] = await templateRepo().findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });

    return {
      total,
      page,
      pageSize,
      list: list.map(t => this.toSummary(t)),
    };
  }

  static async getTemplateById(templateId: string) {
    const template = await templateRepo().findOne({ where: { template_id: templateId } });
    if (!template) throw new Error('Template not found');
    return this.toDetail(template);
  }

  static async applyTemplate(
    userId: string,
    templateId: string,
    name: string,
    description: string | null,
    totalValue: number,
    adjustments: Record<string, { weight?: number }>
  ) {
    const template = await templateRepo().findOne({ where: { template_id: templateId } });
    if (!template) throw new Error('Template not found');

    const sampleHoldings: any[] = JSON.parse(template.sample_holdings || '[]');
    if (!sampleHoldings.length) throw new Error('Template has no sample holdings');

    // 计算调整后权重；若模板权重未归一化，自动按比例归一化到 100%
    const rawTotalWeight = sampleHoldings.reduce((sum, h) => {
      const adj = adjustments[h.symbol]?.weight;
      return sum + (adj !== undefined ? adj : h.weight);
    }, 0);

    const totalWeight = rawTotalWeight;
    const shouldNormalize = Math.abs(totalWeight - 1.0) > 0.001 && totalWeight > 0;
    if (totalWeight <= 0) {
      throw new Error('模板权重总和必须大于 0');
    }

    const normalizedWeight = (h: any) => {
      const raw = adjustments[h.symbol]?.weight ?? h.weight;
      return shouldNormalize ? raw / totalWeight : raw;
    };

    const normalizedTotalWeight = sampleHoldings.reduce((sum, h) => sum + normalizedWeight(h), 0);
    if (Math.abs(normalizedTotalWeight - 1.0) > 0.001) {
      throw new Error(`调整后总权重必须等于 100%，当前为 ${(normalizedTotalWeight * 100).toFixed(2)}%`);
    }

    // 创建组合（若未提供名称，默认使用模板名称 + 实例）
    const portfolioName = name && name.trim() ? name : `${template.name} 实例`;
    const portfolio = portfolioRepo().create({
      user_id: userId,
      name: portfolioName,
      description,
      type: 'personal',
      risk_level: template.risk_level,
      template_id: templateId,
      settings: {
        investment_goal: 'balanced',
        risk_tolerance: template.risk_level,
      },
    });
    await portfolioRepo().save(portfolio);

    const holdings: Holding[] = [];
    for (const h of sampleHoldings) {
      const weight = normalizedWeight(h);
      if (!weight || weight <= 0) continue;
      // 简化：成本价取 1 元占位，实际应由市场数据补充
      const allocation = new Decimal(totalValue).times(weight);
      const costPrice = new Decimal(1);
      const quantity = allocation.dividedBy(costPrice);

      const holding = holdingRepo().create({
        portfolio_id: portfolio.portfolio_id,
        symbol: h.symbol,
        name: h.name,
        security_type: 'stock',
        sector: h.sector,
        quantity: quantity.toNumber(),
        cost_price: costPrice.toNumber(),
        weight,
        exchange: h.symbol.includes('.') ? h.symbol.split('.')[1] : this.inferExchange(h.symbol),
        metadata: { template_symbol: true },
      });
      await holdingRepo().save(holding);
      holdings.push(holding);
    }

    await PortfolioService.updateStatistics(portfolio.portfolio_id);

    return {
      portfolio_id: portfolio.portfolio_id,
      name: portfolio.name,
      holdings,
      calculation_tasks: {
        var_task_id: null,
        stress_task_id: null,
      },
    };
  }

  private static toSummary(template: PortfolioTemplate) {
    return {
      template_id: template.template_id,
      name: template.name,
      risk_level: template.risk_level,
      description: template.description,
      asset_allocation: JSON.parse(template.asset_allocation || '{}'),
      is_builtin: template.is_builtin,
      sort_order: template.sort_order,
    };
  }

  private static toDetail(template: PortfolioTemplate) {
    return {
      ...this.toSummary(template),
      sector_allocation: JSON.parse(template.sector_allocation || '{}'),
      sample_holdings: JSON.parse(template.sample_holdings || '[]'),
      base_total_value: Number(template.base_total_value),
      disclaimer: template.disclaimer,
    };
  }

  private static inferExchange(symbol: string): string {
    const s = symbol.trim();
    if (s.startsWith('6')) return 'SH';
    if (s.startsWith('0') || s.startsWith('3')) return 'SZ';
    if (s.startsWith('8') || s.startsWith('4')) return 'BJ';
    return 'SH';
  }
}
