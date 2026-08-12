const api = require('../../../utils/api');
const constants = require('../../../utils/constants');
const auth = require('../../../utils/auth');

const typeLabels = constants.REPORT_TYPES.map(t => t.label);

Page({
  data: {
    source: '',
    varId: '',
    portfolioId: '',

    portfolios: [],
    portfolioNames: [],
    portfolioIndex: 0,

    reportTypes: typeLabels,
    reportTypeIndex: 0,

    reportName: '',

    loading: false,
    generating: false,
    pollCount: 0,
    error: '',
    errorMsg: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({
      source: options.source || 'list',
      varId: options.varId || '',
      portfolioId: options.portfolioId || ''
    });
    this.loadPortfolios();
  },

  async loadPortfolios() {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const res = await api.get('/portfolios');
      const portfolios = res.data || [];
      const portfolioNames = portfolios.map(p => p.name || '未命名组合');
      let portfolioIndex = 0;
      if (this.data.portfolioId) {
        const idx = portfolios.findIndex(p => p.portfolio_id === this.data.portfolioId);
        if (idx >= 0) portfolioIndex = idx;
      }
      this.setData({ portfolios, portfolioNames, portfolioIndex, loading: false });
    } catch (e) {
      console.error('Load portfolios failed', e);
      this.setData({ error: '加载组合失败', errorMsg: e.message || '请稍后重试', loading: false });
    }
  },

  onRetry() {
    this.loadPortfolios();
  },

  onPortfolioChange(e) {
    this.setData({ portfolioIndex: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ reportTypeIndex: e.detail.value });
  },

  onNameInput(e) {
    this.setData({ reportName: e.detail.value });
  },

  validate() {
    const { portfolios, portfolioIndex } = this.data;
    if (!portfolios.length || !portfolios[portfolioIndex]) {
      wx.showToast({ title: '请选择组合', icon: 'none' });
      return false;
    }
    return true;
  },

  async generateReport() {
    if (!this.validate()) return;
    const { portfolios, portfolioIndex, reportTypeIndex, reportName, varId, source } = this.data;
    const portfolio = portfolios[portfolioIndex];
    const reportType = constants.REPORT_TYPES[reportTypeIndex].key;

    const payload = {
      portfolio_id: portfolio.portfolio_id,
      report_type: reportType,
      report_name: reportName || `${typeLabels[reportTypeIndex]} - ${portfolio.name || ''}`
    };
    if (source === 'var' && varId) {
      payload.var_id = varId;
    }

    this.setData({ loading: true });
    try {
      const res = await api.post('/reports', payload);
      const report = res.data || {};
      if (report.status === 'generating' || report.status === 'pending') {
        this.setData({ generating: true, loading: false, pollCount: 0 });
        this.pollReport(report.report_id || report.id);
      } else {
        wx.navigateTo({
          url: `/pages/reports/detail/detail?id=${report.report_id || report.id}`
        });
      }
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async pollReport(id) {
    if (!id) return;
    if (this.data.pollCount >= 20) {
      wx.showToast({ title: '生成超时，请稍后查看', icon: 'none' });
      this.setData({ generating: false });
      wx.navigateTo({ url: `/pages/reports/detail/detail?id=${id}` });
      return;
    }
    try {
      const res = await api.get(`/reports/${id}`);
      const report = res.data || {};
      if (report.status === 'completed' || report.status === 'done' || report.status === 'success') {
        this.setData({ generating: false });
        wx.navigateTo({ url: `/pages/reports/detail/detail?id=${id}` });
      } else if (report.status === 'failed' || report.status === 'error') {
        wx.showToast({ title: '生成失败', icon: 'none' });
        this.setData({ generating: false });
      } else {
        this.setData({ pollCount: this.data.pollCount + 1 });
        setTimeout(() => this.pollReport(id), 2000);
      }
    } catch (e) {
      this.setData({ pollCount: this.data.pollCount + 1 });
      setTimeout(() => this.pollReport(id), 2000);
    }
  }
});
