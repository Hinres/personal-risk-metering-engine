/**
 * [PRME-RM-002] 风险预警系统 — 市场预警用户级确认服务
 * 文件: marketAlert.service.ts
 * 需求描述: P1-3 市场波动预警用户级确认管理
 * 最后更新: 2026-07-07
 */
import { AppDataSource } from '../config/database';
import { MarketRiskAlert } from '../models/MarketRiskAlert';
import { MarketRiskAlertAcknowledgment } from '../models/MarketRiskAlertAcknowledgment';
import { User } from '../models/User';
import logger from '../utils/logger';

const alertRepo = () => AppDataSource.getRepository(MarketRiskAlert);
const ackRepo = () => AppDataSource.getRepository(MarketRiskAlertAcknowledgment);
const userRepo = () => AppDataSource.getRepository(User);

export interface MarketAlertWithAckStatus {
  alert_id: string;
  index_symbol: string;
  index_name: string;
  previous_close: number;
  current_close: number;
  change_percentage: number;
  title: string;
  message: string;
  triggered_at: Date;
  created_at: Date;
  acknowledged: boolean;
  acknowledged_at: Date | null;
}

export class MarketAlertService {
  /**
   * 获取用户的市场预警列表（含确认状态）
   * 默认返回最近30天的预警，按触发时间倒序
   */
  static async getUserAlerts(
    userId: string,
    options: {
      acknowledged?: boolean | null; // null=全部, true=已确认, false=未确认
      days?: number;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    alerts: MarketAlertWithAckStatus[];
    total: number;
    unacknowledged_count: number;
  }> {
    const days = options.days ?? 30;
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. 获取市场预警基础列表
    const qb = alertRepo().createQueryBuilder('a')
      .where('a.triggered_at >= :since', { since })
      .orderBy('a.triggered_at', 'DESC');

    const [alerts, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    // 2. 获取该用户已确认的 alert_id 集合
    const alertIds = alerts.map(a => a.alert_id);
    let ackMap = new Map<string, Date>();
    if (alertIds.length > 0) {
      const acks = await ackRepo().createQueryBuilder('ack')
        .where('ack.user_id = :userId', { userId })
        .andWhere('ack.alert_id IN (:...alertIds)', { alertIds })
        .getMany();
      for (const ack of acks) {
        ackMap.set(ack.alert_id, ack.acknowledged_at);
      }
    }

    // 3. 构建带确认状态的结果
    const result = alerts.map(alert => ({
      alert_id: alert.alert_id,
      index_symbol: alert.index_symbol,
      index_name: alert.index_name,
      previous_close: Number(alert.previous_close),
      current_close: Number(alert.current_close),
      change_percentage: Number(alert.change_percentage),
      title: alert.title,
      message: alert.message,
      triggered_at: alert.triggered_at,
      created_at: alert.created_at,
      acknowledged: ackMap.has(alert.alert_id),
      acknowledged_at: ackMap.get(alert.alert_id) || null,
    }));

    // 4. 按 acknowledged 过滤
    let filtered = result;
    if (options.acknowledged === true) {
      filtered = result.filter(r => r.acknowledged);
    } else if (options.acknowledged === false) {
      filtered = result.filter(r => !r.acknowledged);
    }

    const unacknowledgedCount = result.filter(r => !r.acknowledged).length;

    return {
      alerts: filtered,
      total: filtered.length,
      unacknowledged_count: unacknowledgedCount,
    };
  }

  /**
   * 用户确认市场预警
   */
  static async acknowledgeAlert(userId: string, alertId: string): Promise<{
    success: boolean;
    alreadyAcknowledged: boolean;
    acknowledged_at?: Date;
  }> {
    // 检查预警是否存在
    const alert = await alertRepo().findOne({ where: { alert_id: alertId } });
    if (!alert) {
      throw new Error('Alert not found');
    }

    // 检查是否已确认
    const existing = await ackRepo().findOne({
      where: { user_id: userId, alert_id: alertId },
    });
    if (existing) {
      return { success: true, alreadyAcknowledged: true, acknowledged_at: existing.acknowledged_at };
    }

    // 创建确认记录
    const ack = ackRepo().create({
      user_id: userId,
      alert_id: alertId,
    });
    await ackRepo().save(ack);

    // 更新全局确认计数
    const ackCount = await ackRepo().count({ where: { alert_id: alertId } });
    alert.acknowledged_count = ackCount;
    await alertRepo().save(alert);

    logger.info(`Market alert acknowledged by user`, { userId, alertId, ackCount });

    return { success: true, alreadyAcknowledged: false, acknowledged_at: ack.acknowledged_at };
  }

  /**
   * 批量确认用户所有未确认预警
   */
  static async acknowledgeAllAlerts(userId: string): Promise<{
    acknowledged_count: number;
  }> {
    const days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 获取用户未确认的预警
    const alerts = await alertRepo().createQueryBuilder('a')
      .where('a.triggered_at >= :since', { since })
      .orderBy('a.triggered_at', 'DESC')
      .getMany();

    const alertIds = alerts.map(a => a.alert_id);
    if (alertIds.length === 0) return { acknowledged_count: 0 };

    // 已确认的
    const acks = await ackRepo().createQueryBuilder('ack')
      .where('ack.user_id = :userId', { userId })
      .andWhere('ack.alert_id IN (:...alertIds)', { alertIds })
      .getMany();
    const ackedIds = new Set(acks.map(a => a.alert_id));

    let count = 0;
    for (const alert of alerts) {
      if (!ackedIds.has(alert.alert_id)) {
        const ack = ackRepo().create({ user_id: userId, alert_id: alert.alert_id });
        await ackRepo().save(ack);
        count++;
      }
    }

    // 更新所有相关预警的确认计数
    for (const alert of alerts) {
      const ackCount = await ackRepo().count({ where: { alert_id: alert.alert_id } });
      alert.acknowledged_count = ackCount;
      await alertRepo().save(alert);
    }

    logger.info(`Bulk acknowledge market alerts`, { userId, count });
    return { acknowledged_count: count };
  }

  /**
   * 获取预警统计信息
   */
  static async getAlertStats(userId: string): Promise<{
    total_alerts_30d: number;
    acknowledged_count: number;
    unacknowledged_count: number;
    acknowledgment_rate: number;
  }> {
    const { alerts, unacknowledged_count } = await this.getUserAlerts(userId, { days: 30 });
    const total = alerts.length;
    const acknowledged = total - unacknowledged_count;
    return {
      total_alerts_30d: total,
      acknowledged_count: acknowledged,
      unacknowledged_count,
      acknowledgment_rate: total > 0 ? parseFloat((acknowledged / total).toFixed(4)) : 0,
    };
  }

  /**
   * 获取未确认预警数量（用于小红点/徽章）
   */
  static async getUnacknowledgedCount(userId: string): Promise<number> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const alerts = await alertRepo().createQueryBuilder('a')
      .where('a.triggered_at >= :since', { since })
      .getMany();

    const alertIds = alerts.map(a => a.alert_id);
    if (alertIds.length === 0) return 0;

    const acks = await ackRepo().createQueryBuilder('ack')
      .where('ack.user_id = :userId', { userId })
      .andWhere('ack.alert_id IN (:...alertIds)', { alertIds })
      .getMany();

    const ackedIds = new Set(acks.map(a => a.alert_id));
    return alertIds.filter(id => !ackedIds.has(id)).length;
  }
}

export default MarketAlertService;
