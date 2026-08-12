const api = require('../../../utils/api');
const { formatCurrency, formatPercent, formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolio: null,
    holdings: [],
    portfolioId: '',
    loading: false,
    error: false,
    errorMessage: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.id });
    this.loadDetail(options.id);
  },

  onShow() {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    if (this.data.portfolioId) {
      this.loadDetail(this.data.portfolioId);
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true, error: false });
    try {
      const [portfolioRes, holdingsRes] = await Promise.all([
        api.get(`/portfolios/${id}`),
        api.get(`/holdings/portfolio/${id}`).catch(() => ({ data: [] }))
      ]);
      const portfolio = portfolioRes.data || {};
      portfolio.total_value_fmt = formatCurrency(portfolio.total_value);
      portfolio.return_rate_fmt = formatPercent(portfolio.return_rate / 100);
      portfolio.return_color = portfolio.return_rate >= 0 ? '#27ae60' : '#e74c3c';
      portfolio.created_at_fmt = formatDate(portfolio.created_at);

      const holdings = (holdingsRes.data || []).map(h => ({
        ...h,
        market_value_fmt: formatCurrency(h.market_value),
        cost_fmt: formatCurrency(h.quantity * h.cost_price),
        pnl: (h.market_value - h.quantity * h.cost_price).toFixed(2),
        pnl_color: (h.market_value - h.quantity * h.cost_price) >= 0 ? '#27ae60' : '#e74c3c'
      }));

      this.setData({ portfolio, holdings, error: false, errorMessage: '' });
    } catch (e) {
      console.error('Load portfolio detail failed', e);
      this.setData({ error: true, errorMessage: e.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRetry() {
    this.loadDetail(this.data.portfolioId);
  },

  goToEditPortfolio() {
    wx.navigateTo({ url: `/pages/portfolio/edit/edit?id=${this.data.portfolioId}` });
  },

  goToAddHolding() {
    wx.navigateTo({ url: `/pages/holding/add/add?portfolioId=${this.data.portfolioId}` });
  },

  goToEditHolding(e) {
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
          this.loadDetail(this.data.portfolioId);
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  deletePortfolio() {
    wx.showModal({
      title: '确认删除组合',
      content: '删除组合将同时删除其全部持仓，是否继续？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中' });
        try {
          await api.del(`/portfolios/${this.data.portfolioId}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  goToVaR() {
    wx.navigateTo({ url: `/pages/var/calculate/calculate?portfolioId=${this.data.portfolioId}` });
  },

  goToStress() {
    wx.navigateTo({ url: `/pages/stress/run/run?portfolioId=${this.data.portfolioId}` });
  },

  goToReports() {
    wx.navigateTo({ url: `/pages/reports/list/list?portfolioId=${this.data.portfolioId}` });
  },

  goToMonitors() {
    wx.navigateTo({ url: `/pages/monitor/rules/rules?portfolioId=${this.data.portfolioId}` });
  }
});
