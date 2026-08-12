/**
 * [PRME-RM-002] 风险预警系统
 * 文件: marketFluctuation.job.ts
 * 需求描述: 市场波动±5%自动检测与全量推送（P2-1）
 * 最后更新: 2026-06-19
 */
import cron, { ScheduledTask } from 'node-cron';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { MarketRiskAlert } from '../models/MarketRiskAlert';
import { MarketRiskAlertTemplate } from '../models/MarketRiskAlertTemplate';
import { User } from '../models/User';
import WebSocketService from '../services/websocket.service';
import logger from '../utils/logger';

const THRESHOLD = 0.05; // ±5%
const INDEX_SYMBOL = '000001.SH'; // 上证指数
const INDEX_NAME = '上证指数';
const TUSHARE_API_URL = 'http://api.tushare.pro';
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';

// T-9: 本地测试模式开关
const MOCK_MODE = process.env.MARKET_FLUCTUATION_MOCK === 'true' || process.env.NODE_ENV === 'test';

// 模拟指数数据（本地测试用）
const MOCK_INDEX_DATA = [
  { previousClose: 3000, currentClose: 3150, changePercentage: 0.05 },   // 正好 5%
  { previousClose: 3000, currentClose: 3180, changePercentage: 0.06 },   // 超过 5%
  { previousClose: 3000, currentClose: 2850, changePercentage: -0.05 }, // -5%
  { previousClose: 3000, currentClose: 2980, changePercentage: -0.0067 }, // 正常波动
  { previousClose: 3000, currentClose: 2700, changePercentage: -0.10 },  // -10%
];

let mockDataIndex = 0;

/**
 * 获取指数最新涨跌幅
 * 返回 { previousClose, currentClose, changePercentage }
 */
export async function getIndexChangePercentage(): Promise<{
  previousClose: number;
  currentClose: number;
  changePercentage: number;
} | null> {
  // T-9: 本地测试模式（无需 Tushare API）
  if (MOCK_MODE) {
    const data = MOCK_INDEX_DATA[mockDataIndex % MOCK_INDEX_DATA.length];
    mockDataIndex++;
    logger.info('[MOCK] Market fluctuation data', { ...data });
    return data;
  }

  if (!TUSHARE_TOKEN) {
    logger.warn('TUSHARE_TOKEN not set, skipping market fluctuation check');
    return null;
  }

  try {
    // 获取最近2个交易日数据
    const res = await axios.post(TUSHARE_API_URL, {
      token: TUSHARE_TOKEN,
      api_name: 'index_daily',
      params: { ts_code: INDEX_SYMBOL, limit: 2 },
      fields: 'trade_date,close,pre_close',
    }, { timeout: 10000 });

    if (!res.data?.data?.items || res.data.data.items.length < 2) {
      logger.warn('Insufficient index data for fluctuation check');
      return null;
    }

    const items = res.data.data.items; // [latest, previous]
    const latest = items[0];
    const previous = items[1];

    const currentClose = parseFloat(latest[1] || 0); // close
    const previousClose = parseFloat(previous[1] || 0); // previous close
    const changePercentage = (currentClose - previousClose) / previousClose;

    return { previousClose, currentClose, changePercentage };
  } catch (e: any) {
    logger.error('Failed to get index change percentage', { error: e.message });
    return null;
  }
}

/**
 * 检查市场波动是否超过阈值
 * 交易时段：每15分钟检查一次
 */
export async function checkMarketFluctuation(): Promise<{
  triggered: boolean;
  changePercentage: number;
  alertId?: string;
}> {
  const data = await getIndexChangePercentage();
  if (!data) return { triggered: false, changePercentage: 0 };

  const { previousClose, currentClose, changePercentage } = data;
  const absChange = Math.abs(changePercentage);

  if (absChange >= THRESHOLD) {
    logger.info(`Market fluctuation detected: ${(changePercentage * 100).toFixed(2)}%`, {
      index: INDEX_SYMBOL,
      previousClose,
      currentClose,
    });

    // 创建市场波动预警记录
    const alertRepo = AppDataSource.getRepository(MarketRiskAlert);
    const templateRepo = AppDataSource.getRepository(MarketRiskAlertTemplate);

    // 获取或创建默认模板
    let template = await templateRepo.findOne({ where: { index_symbol: INDEX_SYMBOL, is_active: true } });
    if (!template) {
      template = templateRepo.create({
        index_symbol: INDEX_SYMBOL,
        index_name: INDEX_NAME,
        title_template: '市场波动预警：{index_name} {direction}{change_pct}%',
        message_template: '今日{index_name}出现大幅波动，当前指数{current_close}，较昨日{direction}{change_pct}%。请密切关注您的投资组合风险。',
        is_active: true,
      });
      await templateRepo.save(template);
    }

    const direction = changePercentage > 0 ? '上涨' : '下跌';
    const changePct = (absChange * 100).toFixed(2);

    const title = template.title_template
      .replace('{index_name}', INDEX_NAME)
      .replace('{direction}', direction)
      .replace('{change_pct}', changePct);

    const message = template.message_template
      .replace('{index_name}', INDEX_NAME)
      .replace('{current_close}', currentClose.toFixed(2))
      .replace('{direction}', direction)
      .replace('{change_pct}', changePct);

    const alert = alertRepo.create({
      index_symbol: INDEX_SYMBOL,
      index_name: INDEX_NAME,
      previous_close: previousClose,
      current_close: currentClose,
      change_percentage: changePercentage,
      title,
      message,
      pushed_count: 0,
      acknowledged_count: 0,
      triggered_at: new Date(),
    });
    await alertRepo.save(alert);

    // 全量用户推送
    await pushMarketAlertToAllUsers(alert);

    return { triggered: true, changePercentage, alertId: alert.alert_id };
  }

  return { triggered: false, changePercentage };
}

/**
 * 全量用户推送市场波动预警
 */
async function pushMarketAlertToAllUsers(alert: MarketRiskAlert): Promise<number> {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({ where: { status: 'active' } });

    const ws = WebSocketService.getInstance();
    let pushedCount = 0;

    for (const user of users) {
      try {
        ws.pushAlert(user.user_id, {
          alert_id: alert.alert_id,
          type: 'market_fluctuation',
          title: alert.title,
          message: alert.message,
          severity: Math.abs(alert.change_percentage) >= 0.07 ? 'critical' : 'high',
          triggered_at: alert.triggered_at,
          index_symbol: alert.index_symbol,
          change_percentage: alert.change_percentage,
        });
        pushedCount++;
      } catch (e) {
        // 单个用户推送失败不影响其他用户
      }
    }

    alert.pushed_count = pushedCount;
    await AppDataSource.getRepository(MarketRiskAlert).save(alert);

    logger.info(`Market alert pushed to ${pushedCount} users`, { alertId: alert.alert_id });
    return pushedCount;
  } catch (e: any) {
    logger.error('Failed to push market alert', { error: e.message, alertId: alert.alert_id });
    return 0;
  }
}

/**
 * 调度市场波动检测定时任务
 * 交易时段每15分钟执行一次（9:30-11:30, 13:00-15:00）
 */
export function scheduleMarketFluctuationCheck(): ReturnType<typeof cron.schedule> {
  return cron.schedule('*/15 9-11,13-15 * * 1-5', async () => {
    logger.info('Running market fluctuation check');
    try {
      const result = await checkMarketFluctuation();
      if (result.triggered) {
        logger.warn(`Market fluctuation alert triggered: ${(result.changePercentage * 100).toFixed(2)}%`, {
          alertId: result.alertId,
        });
      } else {
        logger.info(`Market fluctuation check passed: ${(result.changePercentage * 100).toFixed(2)}%`);
      }
    } catch (error: any) {
      logger.error('Market fluctuation check failed', { error: error.message });
    }
  }, { scheduled: true });
}
