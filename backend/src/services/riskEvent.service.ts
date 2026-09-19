/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: riskEvent.service.ts
 * 需求描述: 风险事件采集、匹配、提醒核心服务
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { RiskEvent } from '../models/RiskEvent';
import { RiskEventImpact } from '../models/RiskEventImpact';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import logger from '../utils/logger';

const eventRepo = () => AppDataSource.getRepository(RiskEvent);
const impactRepo = () => AppDataSource.getRepository(RiskEventImpact);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export class RiskEventService {
  /**
   * 获取用户风险事件列表
   */
  static async getUserEvents(userId: string, options: { acknowledged?: boolean; level?: string; page?: number; pageSize?: number }) {
    // DEF-V131-002 惰性匹配：用户查询前先对当前用户补跑匹配管线（幂等，已存在的 impact 不会重复创建），
    // 使 seed 之后新注册/新导入持仓的用户无需重跑 seed 也能看到演示事件。
    try {
      await this.matchEventsForUser(userId);
    } catch (e: any) {
      // 惰性匹配失败不阻塞列表查询（记录日志兜底）
      logger.warn('Lazy risk-event match failed, returning current impacts', { userId, error: e.message });
    }

    const { acknowledged, level, page = 1, pageSize = 20 } = options;

    const where: any = { user_id: userId };
    if (acknowledged !== undefined) where.is_read = acknowledged;

    const [impacts, total] = await impactRepo().findAndCount({
      where,
      relations: ['event'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { created_at: 'DESC' },
    });

    let list = impacts.map((i: any) => ({
      event_id: i.event_id,
      source_type: i.event?.source_type,
      title: i.event?.title,
      level: i.event?.level,
      occurred_at: i.event?.occurred_at,
      is_read: i.is_read,
      affected_holdings: [{
        portfolio_id: i.portfolio_id,
        holding_id: i.holding_id,
        symbol: i.symbol,
        portfolio_weight: i.portfolio_weight ? Number(i.portfolio_weight) : null,
        impact_summary: i.impact_summary,
      }],
    }));

    if (level) {
      list = list.filter((item: any) => item.level === level);
    }

    return { total, page, pageSize, list };
  }

  /**
   * 确认事件已读
   */
  static async acknowledge(eventId: string, userId: string) {
    const impact = await impactRepo().findOne({
      where: { event_id: eventId, user_id: userId },
    });
    if (!impact) throw new Error('Event not found');
    impact.is_read = true;
    impact.read_at = new Date();
    await impactRepo().save(impact);
    return { event_id: eventId, acknowledged_at: impact.read_at };
  }

  /**
   * 匹配事件与用户持仓。
   * DEF-V131-002 语义修正：
   * - 不再按 is_processed 过滤/置位。原实现处理完即全局置 is_processed=true，
   *   多用户场景下第一个用户（即使无匹配持仓）就会把全部事件消耗掉，
   *   导致后续用户永远无法匹配；seed 之后的新用户同样永远看不到事件。
   * - 幂等去重由 (event_id, user_id, holding_id) 唯一性检查保证，
   *   事件可安全地被任意用户在任意时刻重复匹配。
   * - is_processed 字段保留（历史迁移/采集器仍写入），当前匹配管线不再读写其语义；
   *   生产接入真实事件源、事件量增长后，如需按处理状态过滤，应改为 per-user 处理标记或时间窗过滤。
   */
  static async matchEventsForUser(userId: string): Promise<number> {
    const portfolios = await portfolioRepo().find({ where: { user_id: userId, status: 'active' } });
    if (portfolios.length === 0) return 0;
    let count = 0;

    const allEvents = await eventRepo().find();

    for (const event of allEvents) {
      const symbols: string[] = event.symbols ? JSON.parse(event.symbols) : [];
      const sectors: string[] = event.sectors ? JSON.parse(event.sectors) : [];

      for (const portfolio of portfolios) {
        const holdings = await holdingRepo().find({ where: { portfolio_id: portfolio.portfolio_id } });
        const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.market_value?.toString() || 0), 0);

        for (const h of holdings) {
          const matchedSymbol = symbols.includes(h.symbol);
          const matchedSector = sectors.includes(h.sector || '');
          if (!matchedSymbol && !matchedSector) continue;

          const weight = portfolioValue > 0 ? Number(h.market_value?.toString() || 0) / portfolioValue : 0;
          const impactLevel = this.mapEventLevel(event.level);
          const summary = this.generateImpactSummary(event, h);

          const exists = await impactRepo().findOne({
            where: { event_id: event.event_id, user_id: userId, holding_id: h.holding_id },
          });
          if (exists) continue;

          const entity = impactRepo().create({
            event_id: event.event_id,
            user_id: userId,
            portfolio_id: portfolio.portfolio_id,
            holding_id: h.holding_id,
            symbol: h.symbol,
            impact_level: impactLevel,
            impact_summary: summary,
            portfolio_weight: weight,
          });
          await impactRepo().save(entity);
          count++;
        }
      }

    }

    return count;
  }

  private static mapEventLevel(level: string): 'critical' | 'high' | 'medium' | 'low' {
    if (level === 'critical') return 'critical';
    if (level === 'high') return 'high';
    if (level === 'medium') return 'medium';
    return 'low';
  }

  private static generateImpactSummary(event: RiskEvent, holding: Holding): string {
    const templates: Record<string, string> = {
      announcement: `事件「${event.title}」涉及您持仓的 ${holding.symbol}（${holding.name || holding.symbol}）。事件性质为 ${event.level}，可能带来估值承压。请关注后续市场走势。`,
      industry_policy: `行业政策「${event.title}」可能影响您持仓所在的 ${holding.sector || '相关行业'}。请关注行业景气度变化。`,
      macro_data: `宏观数据「${event.title}」发布，可能对您持仓的 ${holding.symbol} 产生影响。请关注市场整体走势。`,
    };
    return templates[event.source_type] || `事件「${event.title}」可能影响您持仓的 ${holding.symbol}，请关注。`;
  }
}
