/**
 * [PRME-INFRA-006] 基础设施
 * 文件: development.seed.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { Stock } from '../models/Stock';
import { MarketData } from '../models/MarketData';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { SystemConfig } from '../models/SystemConfig';
import logger from '../utils/logger';

/**
 * 开发环境种子数据
 */
export async function seedDatabase() {
  const dataSource = AppDataSource;
  
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  
  logger.info('🌱 Starting database seeding...');
  
  try {
    // 1. 创建测试用户
    const userRepo = dataSource.getRepository(User);
    const testUser = userRepo.create({
      username: 'testuser',
      email: 'test@example.com',
      phone: '13800138000',
      password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', // "password123"
      status: 'active',
      preferences: {
        language: 'zh-CN',
        theme: 'dark',
        notifications: true,
        risk_tolerance: 'moderate',
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
      },
      subscription: {
        plan: 'professional',
        status: 'active',
        expires_at: new Date('2026-12-31'),
        features: ['advanced_var', 'stress_test', 'realtime_monitoring'],
      },
    });
    const savedUser = await userRepo.save(testUser);
    logger.info('✅ Test user created:', { user_id: savedUser.user_id });
    
    // 2. 创建股票基础数据（stocks表）
    const stockRepo = dataSource.getRepository(Stock);
    const stocksData = [
      { symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE', sector: '消费品', industry: '白酒' },
      { symbol: '000858.SZ', name: '五粮液', exchange: 'SZSE', sector: '消费品', industry: '白酒' },
      { symbol: '300750.SZ', name: '宁德时代', exchange: 'SZSE', sector: '工业', industry: '电池' },
      { symbol: '601318.SH', name: '中国平安', exchange: 'SSE', sector: '金融', industry: '保险' },
      { symbol: '000333.SZ', name: '美的集团', exchange: 'SZSE', sector: '家电', industry: '家用电器' },
      { symbol: '510300.SH', name: '沪深300ETF', exchange: 'SSE', sector: '指数', industry: 'ETF' },
    ];
    for (const s of stocksData) {
      const stock = stockRepo.create(s);
      await stockRepo.save(stock);
    }
    logger.info(`✅ ${stocksData.length} stocks created`);
    
    // 3. 创建市场数据（market_data表）
    const marketDataRepo = dataSource.getRepository(MarketData);
    const today = new Date().toISOString().slice(0, 10);
    const marketDataEntries = [
      { symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE', sector: '消费品', industry: '白酒', close_price: 1680.00, open_price: 1670.00, high_price: 1690.00, low_price: 1665.00, volume: 25000, trade_date: today },
      { symbol: '000858.SZ', name: '五粮液', exchange: 'SZSE', sector: '消费品', industry: '白酒', close_price: 158.00, open_price: 156.00, high_price: 160.00, low_price: 155.00, volume: 450000, trade_date: today },
      { symbol: '300750.SZ', name: '宁德时代', exchange: 'SZSE', sector: '工业', industry: '电池', close_price: 210.00, open_price: 208.00, high_price: 215.00, low_price: 205.00, volume: 320000, trade_date: today },
      { symbol: '601318.SH', name: '中国平安', exchange: 'SSE', sector: '金融', industry: '保险', close_price: 48.00, open_price: 47.50, high_price: 48.50, low_price: 47.20, volume: 890000, trade_date: today },
      { symbol: '000333.SZ', name: '美的集团', exchange: 'SZSE', sector: '家电', industry: '家用电器', close_price: 58.50, open_price: 58.00, high_price: 59.00, low_price: 57.80, volume: 120000, trade_date: today },
      { symbol: '510300.SH', name: '沪深300ETF', exchange: 'SSE', sector: '指数', industry: 'ETF', close_price: 4.20, open_price: 4.15, high_price: 4.25, low_price: 4.12, volume: 5000000, trade_date: today },
    ];
    for (const md of marketDataEntries) {
      const entry = marketDataRepo.create(md);
      await marketDataRepo.save(entry);
    }
    logger.info(`✅ ${marketDataEntries.length} market data entries created`);
    
    // 4. 创建投资组合
    const portfolioRepo = dataSource.getRepository(Portfolio);
    const testPortfolio = portfolioRepo.create({
      user_id: savedUser.user_id,
      name: '我的股票组合',
      description: 'A股核心资产配置',
      type: 'personal',
      status: 'active',
      settings: {
        risk_tolerance: 'moderate',
        rebalancing: false,
        auto_optimize: true,
        alert_enabled: true,
        base_currency: 'CNY',
        benchmark: 'CSI300',
      },
    });
    const savedPortfolio = await portfolioRepo.save(testPortfolio);
    logger.info('✅ Test portfolio created:', { portfolio_id: savedPortfolio.portfolio_id });
    
    // 5. 创建持仓
    const holdingRepo = dataSource.getRepository(Holding);
    const holdings = [
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '600519.SH',
        name: '贵州茅台',
        security_type: 'stock',
        exchange: 'SSE',
        quantity: 100,
        cost_price: 1500.00,
        current_price: 1680.00,
        market_value: 168000.00,
        weight: 0.35,
        unrealized_pnl: 18000.00,
        sector: '消费品',
        industry: '白酒',
        region: '中国大陆',
      },
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '000858.SZ',
        name: '五粮液',
        security_type: 'stock',
        exchange: 'SZSE',
        quantity: 200,
        cost_price: 120.00,
        current_price: 158.00,
        market_value: 31600.00,
        weight: 0.15,
        unrealized_pnl: 7600.00,
        sector: '消费品',
        industry: '白酒',
        region: '中国大陆',
      },
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '300750.SZ',
        name: '宁德时代',
        security_type: 'stock',
        exchange: 'SZSE',
        quantity: 150,
        cost_price: 200.00,
        current_price: 210.00,
        market_value: 31500.00,
        weight: 0.20,
        unrealized_pnl: 1500.00,
        sector: '工业',
        industry: '电池',
        region: '中国大陆',
      },
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '601318.SH',
        name: '中国平安',
        security_type: 'stock',
        exchange: 'SSE',
        quantity: 500,
        cost_price: 45.00,
        current_price: 48.00,
        market_value: 24000.00,
        weight: 0.12,
        unrealized_pnl: 1500.00,
        sector: '金融',
        industry: '保险',
        region: '中国大陆',
      },
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '000333.SZ',
        name: '美的集团',
        security_type: 'stock',
        exchange: 'SZSE',
        quantity: 300,
        cost_price: 55.00,
        current_price: 58.50,
        market_value: 17550.00,
        weight: 0.08,
        unrealized_pnl: 1050.00,
        sector: '家电',
        industry: '家用电器',
        region: '中国大陆',
      },
      {
        portfolio_id: savedPortfolio.portfolio_id,
        symbol: '510300.SH',
        name: '沪深300ETF',
        security_type: 'etf',
        exchange: 'SSE',
        quantity: 5000,
        cost_price: 4.00,
        current_price: 4.20,
        market_value: 21000.00,
        weight: 0.10,
        unrealized_pnl: 1000.00,
        sector: '指数',
        industry: 'ETF',
        region: '中国大陆',
      },
    ];
    
    for (const holdingData of holdings) {
      const holding = holdingRepo.create(holdingData);
      await holdingRepo.save(holding);
    }
    logger.info(`✅ ${holdings.length} holdings created`);
    
    // 6. 更新组合统计（SQLite 兼容：直接调用 Service，不使用已移除的 DB 函数）
    const { PortfolioService } = await import('../services/portfolio.service');
    await PortfolioService.updateStatistics(savedPortfolio.portfolio_id);
    
    logger.info('🎉 Database seeding completed successfully!');
    
    return {
      user: savedUser,
      portfolio: savedPortfolio,
      holdingsCount: holdings.length,
    };
  } catch (error: any) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * 清空所有数据（危险操作！）
 */
export async function clearDatabase() {
  const dataSource = AppDataSource;
  
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  
  logger.warn('⚠️ Clearing all database data...');
  
  // SQLite 兼容：按外键依赖逆序逐个 DELETE（不支持 TRUNCATE ... CASCADE）
  const tables = [
    'operation_logs',
    'alert_records',
    'risk_monitors',
    'stress_tests',
    'var_calculations',
    'risk_reports',
    'orders',
    'user_sessions',
    'holdings',
    'portfolios',
    'users',
    'subscription_plans',
    'system_configs',
  ];
  
  for (const table of tables) {
    await dataSource.query(`DELETE FROM ${table}`);
  }
  
  logger.info('✅ Database cleared');
}
