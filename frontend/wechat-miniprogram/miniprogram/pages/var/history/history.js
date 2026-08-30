const api = require('../../../utils/api');
const { formatPercent, formatCurrency, formatDate } = require('../../../utils/format');

Page({
  data: {
    history: [],
    loading: false,
    error: false,
    errorMsg: ''
  },

  onLoad() {
    this.loadHistory();
  },

  onPullDownRefresh() {
    this.loadHistory().finally(() => wx.stopPullDownRefresh());
  },

  async loadHistory() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get('/var/history');
      const data = res.data || res;
      const list = (data.list || data.data || data || []).map(item => ({
        ...item,
        calculated_at_fmt: formatDate(item.calculated_at || item.created_at),
        var_value_fmt: formatCurrency(item.var_value),
        var_percentage_fmt: formatPercent(item.var_percentage || 0),
        confidence_level_fmt: `${Math.round((item.confidence_level || 0) * 100)}%`,
        method_label: item.calculation_type || item.method || '--'
      }));
      this.setData({ history: list, loading: false });
    } catch (e) {
      console.error('Load VaR history failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  onRetry() {
    this.loadHistory();
  }
});
