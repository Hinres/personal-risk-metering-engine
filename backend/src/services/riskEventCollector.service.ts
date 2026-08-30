/**
 * [PRME-v1.3-RM-005] 风险事件外部数据源采集器
 * 文件: riskEventCollector.service.ts
 * 需求描述: 通过 Tushare/AKShare 等外部数据源采集个股公告、行业政策、宏观数据，
 *           标准化为 risk_events 后写入数据库，供风险事件提醒服务匹配用户持仓。
 * 最后更新: 2026-08-25
 *
 * 设计约束（来源 /workspace/architecture/PRME-v1.3-Architecture-Design-RiskManagement-20260819.md §5）：
 * - 采集周期：5 分钟
 * - 端到端延迟目标：< 30 分钟
 * - 事件去重：按 source_id + external_id
 * - 未配置 API Key 时优雅降级：记录 warn 并返回空，不影响现有 manual source
 */
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { RiskEventSource } from '../models/RiskEventSource';
import { RiskEvent } from '../models/RiskEvent';
import logger from '../utils/logger';

const sourceRepo = () => AppDataSource.getRepository(RiskEventSource);
const eventRepo = () => AppDataSource.getRepository(RiskEvent);

export interface RawRiskEvent {
  external_id: string;
  source_type: 'announcement' | 'industry_policy' | 'macro_data';
  title: string;
  summary?: string | null;
  content?: string | null;
  url?: string | null;
  level: 'critical' | 'high' | 'medium' | 'low';
  symbols?: string[];
  sectors?: string[];
  macro_tags?: string[];
  occurred_at: Date;
}

export interface RiskEventAdapter {
  readonly provider: string;
  collect(source: RiskEventSource): Promise<RawRiskEvent[]>;
}

/**
 * Tushare 个股公告适配器
 * API: anns
 * 文档: https://tushare.pro/document/2?doc_id=168
 */
class TushareAnnouncementAdapter implements RiskEventAdapter {
  readonly provider = 'tushare';
  private readonly apiUrl = 'http://api.tushare.pro';

  async collect(source: RiskEventSource): Promise<RawRiskEvent[]> {
    const token = process.env.TUSHARE_TOKEN || '';
    if (!token) {
      logger.warn('TUSHARE_TOKEN not set, skipping Tushare announcement collection', { sourceId: source.source_id });
      return [];
    }

    try {
      // 默认取最近 3 天，避免一次性拉取过多
      const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const start = new Date();
      start.setDate(start.getDate() - 3);
      const startDate = start.toISOString().slice(0, 10).replace(/-/g, '');

      const res = await axios.post(this.apiUrl, {
        token,
        api_name: 'anns',
        params: { start_date: startDate, end_date: endDate },
        fields: 'ts_code,name,title,url,publish_date',
      }, { timeout: 30000 });

      if (!res.data?.data?.fields || !res.data?.data?.items) {
        logger.warn('Tushare anns returned empty data', { sourceId: source.source_id });
        return [];
      }

      const fields: string[] = res.data.data.fields;
      const items: any[][] = res.data.data.items;

      return items.map((item) => {
        const row: Record<string, any> = {};
        fields.forEach((f, i) => (row[f] = item[i]));
        const tsCode = row.ts_code || '';
        const symbol = tsCode.includes('.') ? tsCode.split('.')[0] : tsCode;
        const publishDate = row.publish_date || row.ann_date || endDate;
        const occurredAt = this.parseDate(String(publishDate));
        const externalId = `${row.ts_code || ''}-${publishDate}-${row.title || ''}`.slice(0, 255);

        return {
          external_id: externalId,
          source_type: 'announcement',
          title: row.title || '个股公告',
          summary: null,
          content: row.content || null,
          url: row.url || null,
          level: this.inferLevel(row.title || ''),
          symbols: symbol ? [symbol] : [],
          sectors: [],
          macro_tags: [],
          occurred_at: occurredAt,
        };
      });
    } catch (e: any) {
      logger.error('Tushare announcement collection failed', { sourceId: source.source_id, error: e.message });
      return [];
    }
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const normalized = String(dateStr).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private inferLevel(title: string): 'critical' | 'high' | 'medium' | 'low' {
    const t = title.toLowerCase();
    if (/停牌|退市|重大违法|立案调查|业绩预减.*50|亏损|预警/.test(t)) return 'critical';
    if (/业绩预减|预亏|监管问询|诉讼|仲裁|高管变动|减持/.test(t)) return 'high';
    if (/行业政策|政策|监管|调整/.test(t)) return 'medium';
    return 'low';
  }
}

/**
 * AKShare 适配器（骨架实现）
 * 由于 AKShare 是 Python 库，Node.js 后端无法直接调用。当前实现为 HTTP 占位：
 * - 若环境变量 AKSHARE_HTTP_URL 指向 AKShare HTTP 服务，则尝试调用。
 * - 否则记录 warn 并返回空，等待 PM/运维提供 AKShare HTTP 地址或 Python 采集脚本。
 *
 * 覆盖：行业政策、宏观数据
 */
class AkshareAdapter implements RiskEventAdapter {
  readonly provider = 'akshare';

  async collect(source: RiskEventSource): Promise<RawRiskEvent[]> {
    const akshareHttpUrl = process.env.AKSHARE_HTTP_URL || '';
    if (!akshareHttpUrl) {
      logger.warn('AKSHARE_HTTP_URL not set, skipping AKShare collection', {
        sourceId: source.source_id,
        sourceType: source.source_type,
      });
      return [];
    }

    try {
      // 根据 source_type 选择不同 AKShare 公开接口
      const interfaceName = source.source_type === 'industry_policy' ? 'news_economic_baidu' : 'macro_cn';
      const res = await axios.get(`${akshareHttpUrl}/api/public/${interfaceName}`, { timeout: 30000 });
      const items = Array.isArray(res.data) ? res.data : [];

      return items.slice(0, 50).map((item: any, idx: number) => ({
        external_id: `${source.source_type}-${Date.now()}-${idx}`,
        source_type: source.source_type as any,
        title: item.title || '无标题',
        summary: item.summary || item.content || null,
        content: item.content || null,
        url: item.url || null,
        level: this.inferLevel(item.title || '', source.source_type),
        symbols: item.symbols ? JSON.parse(item.symbols) : [],
        sectors: item.sectors ? JSON.parse(item.sectors) : [],
        macro_tags: item.macro_tags ? JSON.parse(item.macro_tags) : [],
        occurred_at: item.occurred_at ? new Date(item.occurred_at) : new Date(),
      }));
    } catch (e: any) {
      logger.error('AKShare collection failed', { sourceId: source.source_id, error: e.message });
      return [];
    }
  }

  private inferLevel(title: string, sourceType: string): 'critical' | 'high' | 'medium' | 'low' {
    const t = title.toLowerCase();
    if (/重大|危机|衰退|断崖|崩盘/.test(t)) return 'critical';
    if (/负面|收紧|调控|监管|风险/.test(t)) return 'high';
    if (sourceType === 'industry_policy') return 'medium';
    return 'low';
  }
}

/**
 * 手动维护来源适配器
 * 不采集，仅作为 source 存在，供后台人工录入事件。
 */
class ManualAdapter implements RiskEventAdapter {
  readonly provider = 'manual';

  async collect(): Promise<RawRiskEvent[]> {
    return [];
  }
}

export class RiskEventCollectorService {
  private static adapters: Map<string, RiskEventAdapter> = (() => {
    const map = new Map<string, RiskEventAdapter>();
    map.set('tushare', new TushareAnnouncementAdapter());
    map.set('akshare', new AkshareAdapter());
    map.set('manual', new ManualAdapter());
    return map;
  })();

  /**
   * 注册自定义适配器（便于测试与扩展）
   */
  static registerAdapter(provider: string, adapter: RiskEventAdapter) {
    this.adapters.set(provider, adapter);
  }

  /**
   * 执行一次全量采集
   */
  static async collectAll(): Promise<{ total: number; bySource: Record<string, number> }> {
    const sources = await sourceRepo().find({ where: { is_active: true } });
    const bySource: Record<string, number> = {};
    let total = 0;

    for (const source of sources) {
      const adapter = this.adapters.get(source.provider);
      if (!adapter) {
        logger.warn(`No adapter for provider ${source.provider}, skipping`, { sourceId: source.source_id });
        continue;
      }

      try {
        const events = await adapter.collect(source);
        const saved = await this.saveEvents(source, events);
        bySource[source.provider] = (bySource[source.provider] || 0) + saved;
        total += saved;

        source.last_fetch_at = new Date();
        await sourceRepo().save(source);
      } catch (e: any) {
        logger.error(`Risk event collection failed for source ${source.source_id}`, { error: e.message });
      }
    }

    logger.info('Risk event collection completed', { total, bySource });
    return { total, bySource };
  }

  /**
   * 保存原始事件到 risk_events，按 source_id + external_id 去重
   */
  private static async saveEvents(source: RiskEventSource, events: RawRiskEvent[]): Promise<number> {
    let saved = 0;
    for (const e of events) {
      try {
        const exists = await eventRepo().findOne({
          where: { source_id: source.source_id, external_id: e.external_id },
        });
        if (exists) continue;

        const entity = eventRepo().create({
          source_id: source.source_id,
          source_type: e.source_type,
          external_id: e.external_id,
          title: e.title.slice(0, 500),
          summary: e.summary || null,
          content: e.content || null,
          url: e.url || null,
          level: e.level,
          symbols: e.symbols && e.symbols.length ? JSON.stringify(e.symbols) : null,
          sectors: e.sectors && e.sectors.length ? JSON.stringify(e.sectors) : null,
          macro_tags: e.macro_tags && e.macro_tags.length ? JSON.stringify(e.macro_tags) : null,
          occurred_at: e.occurred_at,
          is_processed: false,
        });
        await eventRepo().save(entity);
        saved++;
      } catch (e: any) {
        logger.error('Failed to save risk event', { externalId: e.external_id, error: e.message });
      }
    }
    return saved;
  }
}
