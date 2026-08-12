const app = getApp();
const api = require('../../utils/api');
const { formatCurrency, getRiskColor } = require('../../utils/format');
const { requireLogin, requireRiskAck } = require('../../utils/auth');

Page({
  data: {
    portfolios: [],
    loading: true,
    error: false,
    unreadCount: 0
  },

  onShow() {
    if (!requireLogin()) return;
    requireRiskAck();
    this.loadPortfolios();
    this.setData({ unreadCount: app.globalData.unreadCount || 0 });
  },

  async loadPortfolios() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/portfolios');
      const portfolios = (res.data || []).map(p => ({
        ...p,
        total_value: formatCurrency(p.total_value),
        risk_color: getRiskColor(p.risk_level || 'low')
      }));
      this.setData({ portfolios, loading: false, error: false });
    } catch (e) {
      console.error('Load portfolios failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  onRetry() {
    this.loadPortfolios();
  },

  goToPortfolio(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/portfolio/detail/detail?id=${id}` });
  },

  goToVaR() {
    wx.navigateTo({ url: '/pages/var/calculate/calculate' });
  },

  goToMonitor() {
    wx.switchTab({ url: '/pages/monitor/dashboard/dashboard' });
  },

  goToReports() {
    wx.navigateTo({ url: '/pages/reports/list/list' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  }
});
