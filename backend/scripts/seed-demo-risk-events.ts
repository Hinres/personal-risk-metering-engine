#!/usr/bin/env tsx
/**
 * [PRME-v1.3.1-F04] 风险事件演示数据 seed 脚本
 * 文件: seed-demo-risk-events.ts
 * 需求描述: 向 risk_events 注入覆盖不同级别/类型/行业的演示事件，并触发匹配管线
 *           生成 risk_event_impacts，使 UAT 环境风险事件列表即刻可演示
 * 设计来源: PRME-v1.3.1-Detailed-Design-20260918.md §4
 * 运行方式: DEMO_RISK_EVENT_SEED=1 npx tsx scripts/seed-demo-risk-events.ts
 * 安全门禁: 仅当环境变量 DEMO_RISK_EVENT_SEED === '1' 时执行；不进 cron，只能人工在 UAT/演示环境执行
 * 幂等: 以 external_id（DEMO-EVT-xxx）判重，已存在即跳过
 * 日期: 2026-09-18
 */
import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, closeDatabase, AppDataSource } from '../src/config/database';
import { RiskEventSource } from '../src/models/RiskEventSource';
import { RiskEvent } from '../src/models/RiskEvent';
import { RiskEventImpact } from '../src/models/RiskEventImpact';
import { User } from '../src/models/User';
import { Portfolio } from '../src/models/Portfolio';
import { RiskEventService } from '../src/services/riskEvent.service';
import logger from '../src/utils/logger';

/** 演示事件矩阵：覆盖不同级别 / 类型 / 影响行业（设计 §4.2） */
const DEMO_EVENTS: Array<{
  external_id: string;
  source_type: 'announcement' | 'industry_policy' | 'macro_data';
  level: 'critical' | 'high' | 'medium' | 'low';
  sectors: string[];
  symbols: string[];
  macro_tags?: string[];
  title: string;
  summary: string;
  /** 距今天数（近 7 个自然日内分散时点） */
  daysAgo: number;
}> = [
  { external_id: 'DEMO-EVT-001', source_type: 'announcement', level: 'critical', sectors: ['白酒'], symbols: ['600519'], title: '龙头酒企发布重大监管相关公告', summary: '某白酒龙头企业就监管事项发布重要公告，短期估值或承压，建议关注持仓风险敞口。', daysAgo: 1 },
  { external_id: 'DEMO-EVT-002', source_type: 'announcement', level: 'high', sectors: ['银行'], symbols: ['000001'], title: '股份制银行重要股东披露减持计划', summary: '某股份行重要股东计划减持，可能对股价形成阶段性压力。', daysAgo: 2 },
  { external_id: 'DEMO-EVT-003', source_type: 'industry_policy', level: 'high', sectors: ['医药'], symbols: ['600276'], title: '药品集采政策扩围至新批次品类', summary: '集采政策扩围，医药板块相关标的盈利预期面临调整。', daysAgo: 3 },
  { external_id: 'DEMO-EVT-004', source_type: 'industry_policy', level: 'medium', sectors: ['新能源'], symbols: ['300750'], title: '新能源汽车补贴政策迎来调整', summary: '新能源车补贴政策调整，产业链上下游景气度可能分化。', daysAgo: 4 },
  { external_id: 'DEMO-EVT-005', source_type: 'macro_data', level: 'medium', sectors: [], symbols: [], macro_tags: ['利率'], title: '重要宏观数据发布超预期', summary: '最新宏观数据超出市场预期，或引发市场波动率上升。', daysAgo: 5 },
  { external_id: 'DEMO-EVT-006', source_type: 'announcement', level: 'low', sectors: ['消费电子'], symbols: ['002594'], title: '消费电子公司发布日常经营公告', summary: '某公司发布日常经营进展公告，影响有限，仅供参考。', daysAgo: 6 },
];

export interface SeedDemoResult {
  inserted: number;
  skipped: number;
  matchedImpacts: number;
}

/**
 * 执行演示事件 seed（幂等）。
 * 生产隔离：由调用方负责环境门禁（主流程检查 DEMO_RISK_EVENT_SEED）。
 */
export async function seedDemoRiskEvents(): Promise<SeedDemoResult> {
  const sourceRepo = AppDataSource.getRepository(RiskEventSource);
  const eventRepo = AppDataSource.getRepository(RiskEvent);

  // 自建演示数据源（provider='manual'）
  let source = await sourceRepo.findOne({ where: { provider: 'manual', name: '演示数据源' } });
  if (!source) {
    source = sourceRepo.create({
      source_type: 'announcement',
      provider: 'manual',
      name: '演示数据源',
      is_active: true,
    });
    await sourceRepo.save(source);
  }

  const result: SeedDemoResult = { inserted: 0, skipped: 0, matchedImpacts: 0 };

  for (const evt of DEMO_EVENTS) {
    const exists = await eventRepo.findOne({ where: { external_id: evt.external_id } });
    if (exists) {
      result.skipped++;
      continue;
    }

    const occurredAt = new Date();
    occurredAt.setDate(occurredAt.getDate() - evt.daysAgo);
    occurredAt.setHours(9 + evt.daysAgo, 30, 0, 0); // 分散时点

    const entity = eventRepo.create({
      source_id: source.source_id,
      source_type: evt.source_type,
      external_id: evt.external_id,
      title: evt.title,
      summary: evt.summary,
      level: evt.level,
      symbols: JSON.stringify(evt.symbols),
      sectors: JSON.stringify(evt.sectors),
      macro_tags: evt.macro_tags ? JSON.stringify(evt.macro_tags) : null,
      occurred_at: occurredAt,
      is_processed: false, // 交由匹配管线处理
    });
    await eventRepo.save(entity);
    result.inserted++;
  }

  // 触发匹配管线：为每个有持仓的用户执行 matchEventsForUser（方式 1，预热）
  // DEF-V131-002：此处仅为预热；seed 之后新注册/新导入持仓的用户无需重跑 seed，
  // 首次调用 getUserEvents 时会自动惰性匹配补齐 impacts。
  const portfolioRepo = AppDataSource.getRepository(Portfolio);
  const userRepo = AppDataSource.getRepository(User);
  const usersWithHoldings = await portfolioRepo
    .createQueryBuilder('p')
    .select('DISTINCT p.user_id', 'user_id')
    .innerJoin('holdings', 'h', 'h.portfolio_id = p.portfolio_id')
    .where('p.status = :status', { status: 'active' })
    .getRawMany();

  for (const row of usersWithHoldings) {
    const user = await userRepo.findOne({ where: { user_id: row.user_id } });
    if (!user) continue;
    try {
      const impacts = await RiskEventService.matchEventsForUser(user.user_id);
      result.matchedImpacts += impacts;
    } catch (e: any) {
      logger.error(`[seed-demo] matchEventsForUser failed for ${user.user_id}`, { error: e.message });
    }
  }

  return result;
}

async function main() {
  // 生产隔离门禁（硬性要求）
  if (process.env.DEMO_RISK_EVENT_SEED !== '1') {
    logger.warn('[seed-demo] DEMO_RISK_EVENT_SEED !== 1, seed skipped. Set DEMO_RISK_EVENT_SEED=1 to run (UAT/demo only).');
    console.log('Skipped: set DEMO_RISK_EVENT_SEED=1 to enable (UAT/demo environments only).');
    return;
  }

  await initializeDatabase();
  try {
    const result = await seedDemoRiskEvents();
    const impactCount = await AppDataSource.getRepository(RiskEventImpact).count();
    logger.info('[seed-demo] completed', { ...result, totalImpacts: impactCount });
    console.log(`Seed complete: inserted=${result.inserted}, skipped=${result.skipped}, newImpacts=${result.matchedImpacts}, totalImpacts=${impactCount}`);
  } finally {
    await closeDatabase();
  }
}

// 直接执行（非测试 import）时运行主流程
if (require.main === module) {
  main().catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
}
