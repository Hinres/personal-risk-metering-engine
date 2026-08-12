const api = require('../../../utils/api');
const { formatCurrency, formatPercent } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    holdings: [],
    loading: false,
    refreshing: false,
    error: false,
    errorMessage: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId });
    this.loadHoldings(options.portfolioId);
  },

  onShow() {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    if (this.data.portfolioId) {
      this.loadHoldings(this.data.portfolioId);
    }
  },

  async loadHoldings(portfolioId) {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get(`/holdings/portfolio/${portfolioId}`);
      const holdings = (res.data || []).map(h => ({
        ...h,
        market_value_fmt: formatCurrency(h.market_value),
        cost_fmt: formatCurrency(h.quantity * h.cost_price),
        pnl: (h.market_value - h.quantity * h.cost_price).toFixed(2),
        pnl_color: (h.market_value - h.quantity * h.cost_price) >= 0 ? '#27ae60' : '#e74c3c',
        weight_fmt: formatPercent(h.weight || 0)
      }));
      this.setData({ holdings, error: false, errorMessage: '' });
    } catch (e) {
      console.error('Load holdings failed', e);
      this.setData({ error: true, errorMessage: e.message || '加载失败' });
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadHoldings(this.data.portfolioId);
  },

  onRetry() {
    this.loadHoldings(this.data.portfolioId);
  },

  goToAdd() {
    wx.navigateTo({ url: `/pages/holding/add/add?portfolioId=${this.data.portfolioId}` });
  },

  goToEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/holding/edit/edit?id=${id}&portfolioId=${this.data.portfolioId}` });
  },

  deleteHolding(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该持仓吗？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中' });
        try {
          await api.del(`/holdings/${id}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadHoldings(this.data.portfolioId);
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  }
});
