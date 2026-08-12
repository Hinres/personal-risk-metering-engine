const { formatCurrency, formatPercent, getRiskColor } = require('../../../utils/format');
const constants = require('../../../utils/constants');
const auth = require('../../../utils/auth');

const CHART_COLORS = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];

function buildFallbackDistribution(components) {
  if (!components || !components.length) return [];
  const sorted = components.slice().sort((a, b) =>
    Math.abs(b.contribution || b.percentage || b.value || 0) - Math.abs(a.contribution || a.percentage || a.value || 0)
  );
  const bins = Math.min(5, sorted.length);
  const step = Math.ceil(sorted.length / bins) || 1;
  const result = [];
  for (let i = 0; i < bins; i++) {
    const slice = sorted.slice(i * step, (i + 1) * step);
    const count = slice.reduce((sum, c) =>
      sum + Math.abs(c.contribution || c.percentage || c.value || 0), 0);
    result.push({ label: `${i + 1}`, count: Math.max(1, count * 100) });
  }
  return result;
}

function normalizeComponents(data) {
  const source = data.components || data.risk_factors || [];
  return source.map((c, i) => ({
    symbol: c.symbol || c.factor || c.name || '未知',
    value: Math.abs(c.contribution || c.percentage || c.value || 0),
    percentage: ((c.contribution || c.percentage || c.value || 0) * 100).toFixed(1),
    color: c.color || CHART_COLORS[i % CHART_COLORS.length]
  }));
}

function methodLabel(key) {
  const m = constants.VAR_METHODS.find(item => item.key === key);
  return m ? m.label : key;
}

Page({
  data: {
    varValue: '--',
    varPercent: '--',
    varColor: '#e74c3c',
    details: [],
    distributionData: [],
    components: [],
    varId: '',
    portfolioId: '',
    safeSummary: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    let data = null;
    if (options.data) {
      try {
        data = JSON.parse(decodeURIComponent(options.data));
      } catch (e) {
        console.error('Parse VaR result failed', e);
      }
    }
    if (!data && options.safeSummary) {
      try {
        data = JSON.parse(decodeURIComponent(options.safeSummary));
        data._shared = true;
      } catch (e) {
        console.error('Parse safeSummary failed', e);
      }
    }
    if (!data) data = {};

    const varValue = data.var_value !== undefined ? data.var_value : data.value;
    const varPercentage = data.var_percentage !== undefined ? data.var_percentage : data.percentage;
    const components = normalizeComponents(data);
    const distributionData = (data.distribution || data.histogram || []).length
      ? (data.distribution || data.histogram)
      : buildFallbackDistribution(data.components || data.risk_factors || []);

    const riskLevel = varPercentage > 0.1 ? 'critical' : varPercentage > 0.05 ? 'high' : varPercentage > 0.02 ? 'medium' : 'low';
    const safeSummary = encodeURIComponent(JSON.stringify({
      method: data.method,
      confidence_level: data.confidence_level,
      time_horizon: data.time_horizon,
      risk_level: riskLevel
    }));

    this.setData({
      varValue: formatCurrency(varValue),
      varPercent: formatPercent(varPercentage),
      varColor: getRiskColor(riskLevel),
      isShared: !!data._shared,
      details: [
        { label: '计算方法', value: methodLabel(data.method) },
        { label: '置信水平', value: formatPercent(data.confidence_level) },
        { label: '时间周期', value: `${data.time_horizon || 1} 天` },
        { label: '预期收益', value: formatPercent(data.expected_return) },
        { label: '波动率', value: formatPercent(data.volatility) }
      ],
      distributionData,
      components,
      varId: options.varId || data.var_id || data.id || '',
      portfolioId: options.portfolioId || data.portfolio_id || '',
      safeSummary
    });
  },

  goToGenerateReport() {
    const { varId, portfolioId } = this.data;
    if (!portfolioId) {
      wx.showToast({ title: '缺少组合信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/reports/generate/generate?source=var&varId=${varId}&portfolioId=${portfolioId}`
    });
  },

  goToHistory() {
    const { varId } = this.data;
    wx.navigateTo({
      url: `/pages/var/report/report?varId=${varId}`
    });
  },

  onShareAppMessage() {
    return {
      title: '我的投资组合风险分析',
      path: `/pages/var/result/result?safeSummary=${this.data.safeSummary}`,
      imageUrl: '/assets/share-risk.png'
    };
  }
});
