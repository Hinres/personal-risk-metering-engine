const api = require('../../../utils/api');
const { formatCurrency, formatPercent, formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

function methodLabel(method) {
  const map = {
    historical: '历史模拟法',
    parametric: '参数法',
    monte_carlo: '蒙特卡洛',
    extreme_value: '极值理论'
  };
  return map[method] || method;
}

Page({
  data: {
    varId: '',
    report: null,
    history: [],
    loading: false,
    error: '',
    errorMsg: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({ varId: options.varId || '' });
    this.loadData();
  },

  onRetry() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const res = await api.get('/var/history');
      const allHistory = (res.data || []).map(r => this.formatReport(r));
      if (this.data.varId) {
        const report = allHistory.find(r => (r.var_id || r.id) === this.data.varId) || null;
        this.setData({ report, history: [] });
      } else {
        this.setData({ report: null, history: allHistory });
      }
    } catch (e) {
      console.error('Load VaR report failed', e);
      this.setData({ error: '加载失败', errorMsg: e.message || '请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatReport(item) {
    if (!item) return null;
    return {
      ...item,
      varValueFmt: formatCurrency(item.var_value),
      varPercentFmt: formatPercent(item.var_percentage),
      createdAtFmt: formatDate(item.created_at || item.calculation_date),
      methodName: methodLabel(item.method)
    };
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/var/report/report?varId=${id}`
    });
  }
});
