const api = require('../../../utils/api');
const { formatPercent, formatCurrency } = require('../../../utils/format');

Page({
  data: {
    portfolioId: '',
    result: null,
    loading: false,
    error: false,
    errorMsg: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.id || '' });
    if (options.id) {
      this.runAttribution(options.id);
    } else {
      this.setData({ error: true, errorMsg: '缺少组合ID' });
    }
  },

  onRetry() {
    if (this.data.portfolioId) {
      this.runAttribution(this.data.portfolioId);
    }
  },

  async runAttribution(portfolioId) {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.post(`/portfolios/${portfolioId}/attribution`);
      const data = res.data || res;
      this.setData({ result: this.formatResult(data), loading: false });
    } catch (e) {
      console.error('Run attribution failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '归因分析失败' });
    }
  },

  formatResult(data) {
    if (!data) return null;
    const r = data.data || data;
    const sectors = (r.sector_details || r.sectors || []);
    return {
      ...r,
      portfolio_return_fmt: formatPercent((r.portfolio_return || 0)),
      benchmark_return_fmt: formatPercent((r.benchmark_return || 0)),
      allocation_effect_fmt: formatPercent((r.allocation_effect || 0)),
      selection_effect_fmt: formatPercent((r.selection_effect || 0)),
      interaction_effect_fmt: formatPercent((r.interaction_effect || 0)),
      sectors: sectors.map(s => ({
        ...s,
        portfolio_weight_fmt: formatPercent((s.portfolio_weight || 0)),
        benchmark_weight_fmt: formatPercent((s.benchmark_weight || 0)),
        return_fmt: formatPercent((s.return_diff || s.return || 0)),
        contribution_fmt: formatPercent((s.total_effect || 0))
      }))
    };
  }
});
