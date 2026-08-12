const api = require('../../../utils/api');
const { formatCurrency, formatPercent, getRiskColor } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolios: [],
    loading: false,
    refreshing: false,
    error: false,
    errorMessage: ''
  },

  onLoad() {
    this.loadPortfolios();
  },

  onShow() {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.loadPortfolios();
  },

  async loadPortfolios() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/portfolios');
      const portfolios = (res.data || []).map(p => ({
        ...p,
        total_value_fmt: formatCurrency(p.total_value),
        return_rate_fmt: formatPercent(p.return_rate / 100),
        return_color: p.return_rate >= 0 ? '#27ae60' : '#e74c3c',
        risk_color: getRiskColor(p.risk_level || 'low')
      }));
      this.setData({ portfolios, error: false, errorMessage: '' });
    } catch (e) {
      console.error('Load portfolios failed', e);
      this.setData({ error: true, errorMessage: e.message || '加载失败' });
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadPortfolios();
  },

  onRetry() {
    this.loadPortfolios();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/portfolio/detail/detail?id=${id}` });
  },

  goToCreate() {
    wx.navigateTo({ url: '/pages/portfolio/create/create' });
  },

  showActions(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/portfolio/edit/edit?id=${id}` });
        } else if (res.tapIndex === 1) {
          this.deletePortfolio(id);
        }
      }
    });
  },

  deletePortfolio(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除组合将同时删除其全部持仓，是否继续？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中' });
        try {
          await api.del(`/portfolios/${id}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadPortfolios();
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  }
});
