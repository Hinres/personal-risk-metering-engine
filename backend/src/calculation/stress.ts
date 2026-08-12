/**
 * [PRME-CALC-004] 压力测试模块
 * 文件: stress.ts
 * 需求描述: 实现压力测试场景定义和组合受压计算
 * 最后更新: 2026-06-17
 */

export interface StressScenario {
  name: string;
  description: string;
  shocks: Record<string, number>;
}

export interface StressTestResult {
  portfolio_value: number;
  stressed_value: number;
  loss_amount: number;
  loss_percentage: number;
  asset_results: AssetStressResult[];
  shocks_applied: Record<string, number>;
}

export interface AssetStressResult {
  symbol: string;
  sector?: string | null;
  industry?: string | null;
  market_value: number;
  shock_key: string;
  shock_rate: number;
  stressed_value: number;
  loss: number;
  loss_percentage: number;
}

export interface HoldingInput {
  symbol: string;
  quantity: number;
  current_price: number;
  sector?: string | null;
  industry?: string | null;
  weight?: number | null;
}

// 行业到冲击因子的映射
const SECTOR_SHOCK_MAP: Record<string, string> = {
  '银行': 'financial_sector',
  '保险': 'financial_sector',
  '证券': 'financial_sector',
  '金融': 'financial_sector',
  '科技': 'tech_sector',
  '计算机': 'tech_sector',
  '电子': 'tech_sector',
  '通信': 'tech_sector',
  '互联网': 'tech_sector',
  '消费': 'consumer_staples',
  '食品饮料': 'consumer_staples',
  '医药': 'consumer_staples',
  '能源': 'energy',
  '石油': 'energy',
  '煤炭': 'energy',
  '材料': 'materials',
  '化工': 'materials',
  '钢铁': 'materials',
  '工业': 'industrial',
  '制造': 'industrial',
  '汽车': 'industrial',
  '房地产': 'real_estate',
  '农业': 'agriculture',
  '旅游': 'travel_leisure',
  '休闲': 'travel_leisure',
  '军工': 'defense',
};

// 预定义压力情景
export const STRESS_SCENARIOS: Record<string, StressScenario> = {
  '2008_financial_crisis': {
    name: '2008年金融危机',
    description: '雷曼兄弟破产引发的全球金融危机',
    shocks: {
      global_equity: -0.40,
      financial_sector: -0.60,
      consumer_staples: -0.20,  // 白酒防御性强，冲击较小
      industrial: -0.50,        // 新能源/工业波动大
      tech_sector: -0.45,
      defense: -0.15,
      credit_spreads: 0.05,
      volatility: 0.80,
    },
  },
  '2020_covid_pandemic': {
    name: '2020年新冠疫情冲击',
    description: 'COVID-19全球大流行导致的市场崩盘',
    shocks: {
      global_equity: -0.35,
      travel_leisure: -0.70,
      oil: -0.50,
      tech: 0.10,
    },
  },
  '2015_a_share_crash': {
    name: '2015年A股股灾',
    description: '中国股市剧烈波动，融资盘踩踏',
    shocks: {
      china_equity: -0.30,
      small_cap: -0.45,
      margin_stocks: -0.50,
    },
  },
  'trade_war': {
    name: '贸易战升级',
    description: '中美贸易摩擦加剧，关税壁垒升级',
    shocks: {
      global_equity: -0.20,
      tech_sector: -0.30,
      emerging_markets: -0.25,
      agriculture: -0.15,
    },
  },
  'inflation_shock': {
    name: '通胀失控',
    description: '通胀率飙升导致央行激进加息',
    shocks: {
      interest_rates: 0.03,
      bonds: -0.15,
      growth_stocks: -0.25,
      value_stocks: -0.05,
    },
  },
  '2022_russia_ukraine': {
    name: '2022年俄乌冲突',
    description: '地缘政治冲突导致能源和粮食危机',
    shocks: {
      global_equity: -0.15,
      energy: 0.60,
      agriculture: 0.40,
      defense: 0.30,
      europe_equity: -0.25,
    },
  },
  'dotcom_bubble': {
    name: '科技泡沫破裂',
    description: '互联网泡沫破裂，科技股集体暴跌',
    shocks: {
      tech_sector: -0.70,
      nasdaq: -0.65,
      growth_stocks: -0.50,
      global_equity: -0.25,
    },
  },
  'sovereign_debt_crisis': {
    name: '主权债务危机',
    description: '多国主权债务违约引发金融市场动荡',
    shocks: {
      bonds: -0.30,
      financial_sector: -0.35,
      emerging_markets: -0.40,
      credit_spreads: 0.08,
      global_equity: -0.20,
    },
  },
  'rate_shock': {
    name: '利率急升',
    description: '央行超预期加息导致资产价格重估',
    shocks: {
      interest_rates: 0.05,
      growth_stocks: -0.35,
      real_estate: -0.30,
      bonds: -0.20,
      value_stocks: -0.10,
    },
  },
  'liquidity_crisis': {
    name: '流动性危机',
    description: '银行间流动性枯竭，信贷紧缩',
    shocks: {
      global_equity: -0.30,
      credit_spreads: 0.10,
      small_cap: -0.45,
      emerging_markets: -0.35,
      bonds: -0.15,
    },
  },
  'commodity_surge': {
    name: '大宗商品暴涨',
    description: '大宗商品价格飙升，通胀压力传导',
    shocks: {
      commodities: 0.50,
      energy: 0.40,
      materials: 0.35,
      global_equity: -0.15,
      consumer_staples: -0.10,
    },
  },
  // NEW-003: 兼容QA测试用例中的 market_crash_2008 别名
  'market_crash_2008': {
    name: '2008年金融危机',
    description: '雷曼兄弟破产引发的全球金融危机（兼容别名）',
    shocks: {
      global_equity: -0.40,
      financial_sector: -0.60,
      consumer_staples: -0.20,
      industrial: -0.50,
      tech_sector: -0.45,
      defense: -0.15,
      credit_spreads: 0.05,
      volatility: 0.80,
    },
  },
};

/**
 * 获取所有压力情景
 */
export function getScenarios(): Record<string, StressScenario> {
  return STRESS_SCENARIOS;
}

/**
 * 获取指定压力情景
 */
export function getScenario(scenarioId: string): StressScenario | undefined {
  return STRESS_SCENARIOS[scenarioId];
}

/**
 * 将行业映射到冲击因子
 */
export function mapSectorToShockKey(sector?: string | null, industry?: string | null): string {
  if (!sector && !industry) return 'default';
  
  for (const label of [industry, sector]) {
    if (label) {
      const key = label.trim();
      if (SECTOR_SHOCK_MAP[key]) {
        return SECTOR_SHOCK_MAP[key];
      }
    }
  }
  return 'default';
}

/**
 * 计算受压组合
 */
export function calculateStressedPortfolio(
  holdings: HoldingInput[],
  shocks: Record<string, number>
): StressTestResult {
  let totalValue = 0;
  let stressedValue = 0;
  const assetResults: AssetStressResult[] = [];

  for (const h of holdings) {
    const marketValue = h.quantity * (h.current_price || 0);
    const shockKey = mapSectorToShockKey(h.sector, h.industry);
    const shockRate = shocks[shockKey] ?? shocks['global_equity'] ?? 0;
    const stressedAssetValue = marketValue * (1 + shockRate);
    const loss = marketValue - stressedAssetValue;

    totalValue += marketValue;
    stressedValue += stressedAssetValue;

    assetResults.push({
      symbol: h.symbol,
      sector: h.sector,
      industry: h.industry,
      market_value: Math.round(marketValue * 100) / 100,
      shock_key: shockKey,
      shock_rate: Math.round(shockRate * 10000) / 10000,
      stressed_value: Math.round(stressedAssetValue * 100) / 100,
      loss: Math.round(loss * 100) / 100,
      loss_percentage: Math.round(Math.abs(shockRate) * 10000) / 100,
    });
  }

  const lossAmount = totalValue - stressedValue;
  const lossPercentage = totalValue > 0 ? -(lossAmount / totalValue * 100) : 0;

  return {
    portfolio_value: Math.round(totalValue * 100) / 100,
    stressed_value: Math.round(stressedValue * 100) / 100,
    loss_amount: Math.round(lossAmount * 100) / 100,
    loss_percentage: Math.round(lossPercentage * 100) / 100,
    asset_results: assetResults,
    shocks_applied: shocks,
  };
}
