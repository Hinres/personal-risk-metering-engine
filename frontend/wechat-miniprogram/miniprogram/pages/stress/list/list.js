const api = require('../../../utils/api');
const { formatCurrency, formatPercent, formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    history: [],
    loading: false,
    refreshing: false,
    error: '',
    errorMsg: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
    this.loadHistory();
  },

  onRetry() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const params = this.data.portfolioId ? `?portfolio_id=${this.data.portfolioId}` : '';
      const res = await api.get(`/stress/history${params}`);
      const history = (res.data || []).map(h => ({
        ...h,
        portfolio_value_fmt: formatCurrency(h.portfolio_value),
        stressed_value_fmt: formatCurrency(h.stressed_value),
        loss_amount_fmt: formatCurrency(h.loss_amount),
        loss_percentage_fmt: formatPercent(h.loss_percentage / 100),
        test_date_fmt: formatDate(h.test_date)
      }));
      this.setData({ history, loading: false, refreshing: false });
    } catch (e) {
      console.error('Load stress history failed', e);
      this.setData({
        error: '加载失败',
        errorMsg: e.message || '请稍后重试',
        loading: false,
        refreshing: false
      });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadHistory();
  },

  goToScenarios() {
    wx.navigateTo({
      url: this.data.portfolioId
        ? `/pages/stress/scenarios/scenarios?portfolioId=${this.data.portfolioId}`
        : '/pages/stress/scenarios/scenarios'
    });
  }
});
