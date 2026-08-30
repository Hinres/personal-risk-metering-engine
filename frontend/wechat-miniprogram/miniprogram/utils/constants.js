/**
 * 业务常量定义
 */

// VaR 计算方法
const VAR_METHODS = [
  { key: 'historical', label: '历史模拟法' },
  { key: 'parametric', label: '参数法' },
  { key: 'monte_carlo', label: '蒙特卡洛模拟' },
  { key: 'extreme_value', label: '极值理论(EVT)' },
];

// 置信水平快捷选项
const CONFIDENCE_OPTIONS = [
  { key: 0.95, label: '95%' },
  { key: 0.99, label: '99%' },
  { key: 0.999, label: '99.9%' },
];

// 时间周期快捷选项（PRD 2.1.1 支持 1-365 天自定义）
const HORIZON_OPTIONS = [
  { key: 1, label: '1天' },
  { key: 7, label: '7天' },
  { key: 30, label: '30天' },
  { key: 90, label: '90天' },
  { key: 180, label: '180天' },
  { key: 365, label: '365天' },
];

// EVT 估计方法
const EVT_ESTIMATION_METHODS = [
  { key: 'pwm', label: '概率加权矩(PWM)' },
  { key: 'mle', label: '极大似然估计(MLE)' },
];

// 监控类型（v1.3 新增止损/风险事件/波动率异常）
const MONITOR_TYPES = [
  { key: 'var', label: 'VaR 绝对值' },
  { key: 'var_percentage', label: 'VaR 百分比' },
  { key: 'var_threshold', label: 'VaR 阈值' },
  { key: 'drawdown', label: '最大回撤' },
  { key: 'concentration', label: '集中度' },
  { key: 'liquidity', label: '流动性' },
  { key: 'stop_loss', label: '止损建议' },
  { key: 'risk_event', label: '风险事件' },
  { key: 'volatility_spike', label: '波动率异常' },
];

// 比较操作（PRD 2.2.2.1 支持 >/ </ >= / <= / =）
const COMPARISONS = [
  { key: 'gt', label: '大于' },
  { key: 'lt', label: '小于' },
  { key: 'gte', label: '大于等于' },
  { key: 'lte', label: '小于等于' },
  { key: 'eq', label: '等于' },
];

// 严重级别
const SEVERITY_LEVELS = [
  { key: 'low', label: '低', color: '#27ae60' },
  { key: 'medium', label: '中', color: '#f39c12' },
  { key: 'high', label: '高', color: '#e74c3c' },
  { key: 'critical', label: '紧急', color: '#c0392b' },
];

// 报告类型
const REPORT_TYPES = [
  { key: 'risk_summary', label: '风险摘要' },
  { key: 'var_analysis', label: 'VaR 分析' },
  { key: 'stress_test', label: '压力测试' },
  { key: 'portfolio_review', label: '组合回顾' },
  { key: 'compliance', label: '合规报告' },
];

// 投资目标
const INVESTMENT_GOALS = [
  { key: 'capital_preservation', label: '保本' },
  { key: 'steady_income', label: '稳健收益' },
  { key: 'balanced', label: '平衡' },
  { key: 'growth', label: '成长' },
  { key: 'aggressive_growth', label: '积极成长' },
];

// 风险等级
const RISK_LEVELS = [
  { key: 'conservative', label: '保守型' },
  { key: 'moderate', label: '稳健型' },
  { key: 'aggressive', label: '积极型' },
];

// 订阅等级
const SUBSCRIPTION_TIERS = [
  { key: 'free', label: '免费版' },
  { key: 'premium', label: '高级版' },
  { key: 'professional', label: '专业版' },
];

module.exports = {
  VAR_METHODS,
  CONFIDENCE_OPTIONS,
  HORIZON_OPTIONS,
  EVT_ESTIMATION_METHODS,
  MONITOR_TYPES,
  COMPARISONS,
  SEVERITY_LEVELS,
  REPORT_TYPES,
  INVESTMENT_GOALS,
  RISK_LEVELS,
  SUBSCRIPTION_TIERS,
};
