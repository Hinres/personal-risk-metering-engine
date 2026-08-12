const api = require('../../../utils/api');
const { formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    reports: [],
    loading: false,
    refreshing: false,
    error: '',
    errorMsg: '',
    portfolioId: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
    this.loadReports();
  },

  onRetry() {
    this.loadReports();
  },

  async loadReports() {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const params = this.data.portfolioId ? `?portfolio_id=${this.data.portfolioId}` : '';
      const res = await api.get(`/reports${params}`);
      const reports = (res.data || []).map(r => ({
        ...r,
        created_at_fmt: formatDate(r.created_at),
        formatLabel: r.format === 'excel' ? 'Excel' : 'PDF',
        typeLabel: this.typeLabel(r.report_type)
      }));
      this.setData({ reports, loading: false, refreshing: false });
    } catch (e) {
      console.error('Load reports failed', e);
      this.setData({ error: '加载失败', errorMsg: e.message || '请稍后重试', loading: false, refreshing: false });
    }
  },

  typeLabel(key) {
    const map = {
      risk_summary: '风险摘要',
      var_analysis: 'VaR 分析',
      stress_test: '压力测试',
      portfolio_review: '组合回顾',
      compliance: '合规报告'
    };
    return map[key] || key;
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadReports();
  },

  goToGenerate() {
    wx.navigateTo({ url: '/pages/reports/generate/generate?source=list' });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reports/detail/detail?id=${id}` });
  }
});
