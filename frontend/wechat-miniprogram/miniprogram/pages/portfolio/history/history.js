const api = require('../../../utils/api');
const { formatCurrency, formatPercent, formatDate } = require('../../../utils/format');

const PERIOD_OPTIONS = [
  { key: '3m', label: '近3个月' },
  { key: '6m', label: '近6个月' },
  { key: '1y', label: '近1年' },
  { key: '2y', label: '近2年' }
];

Page({
  data: {
    portfolioId: '',
    periodIndex: 2,
    PERIOD_OPTIONS,
    current: null,
    history: [],
    changes: null,
    loading: false,
    error: false,
    errorMsg: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.id || '' });
    this.loadHistory();
  },

  onPeriodChange(e) {
    this.setData({ periodIndex: parseInt(e.detail.value, 10) });
    this.loadHistory();
  },

  async loadHistory() {
    const { portfolioId, periodIndex } = this.data;
    if (!portfolioId) {
      this.setData({ error: true, errorMsg: '缺少组合ID' });
      return;
    }
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const period = PERIOD_OPTIONS[periodIndex].key;
      const res = await api.get(`/portfolios/${portfolioId}/historical-comparison?period=${period}`);
      const data = res.data || res;
      this.setData({
        current: this.formatSnapshot(data.current),
        history: (data.history || []).map(h => this.formatSnapshot(h)),
        changes: data.changes,
        loading: false
      });
    } catch (e) {
      console.error('Load historical comparison failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  formatSnapshot(s) {
    if (!s) return null;
    return {
      ...s,
      snapshot_date_fmt: formatDate(s.snapshot_date),
      total_value_fmt: formatCurrency(s.total_value),
      total_return_fmt: formatPercent(s.total_return || 0),
      max_drawdown_fmt: formatPercent(s.max_drawdown || 0),
      sharpe_ratio_fmt: s.sharpe_ratio ? s.sharpe_ratio.toFixed(2) : '--'
    };
  },

  onRetry() {
    this.loadHistory();
  }
});
