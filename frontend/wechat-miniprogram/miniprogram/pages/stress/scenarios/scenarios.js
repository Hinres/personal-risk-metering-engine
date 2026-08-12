const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    scenarios: [],
    expandedId: '',
    loading: false,
    error: '',
    errorMsg: ''
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
    this.loadScenarios();
  },

  onRetry() {
    this.loadScenarios();
  },

  async loadScenarios() {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const res = await api.get('/stress/scenarios');
      const scenarios = (res.data || []).map(s => ({
        ...s,
        shockLabel: this.formatShocks(s.shocks)
      }));
      this.setData({ scenarios, loading: false });
    } catch (e) {
      console.error('Load scenarios failed', e);
      this.setData({ error: '加载失败', errorMsg: e.message || '请稍后重试', loading: false });
    }
  },

  formatShocks(shocks) {
    if (!shocks) return '';
    const parts = [];
    if (shocks.equity !== undefined) parts.push(`股票 ${shocks.equity}%`);
    if (shocks.bond !== undefined) parts.push(`债券 ${shocks.bond}%`);
    if (shocks.fx !== undefined) parts.push(`外汇 ${shocks.fx}%`);
    if (shocks.commodity !== undefined) parts.push(`商品 ${shocks.commodity}%`);
    return parts.join(' / ') || '';
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  goToRun(e) {
    const id = e.currentTarget.dataset.id;
    const url = this.data.portfolioId
      ? `/pages/stress/run/run?scenarioId=${id}&portfolioId=${this.data.portfolioId}`
      : `/pages/stress/run/run?scenarioId=${id}`;
    wx.navigateTo({ url });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const scenario = this.data.scenarios.find(s => (s.id || s.scenario_id) === id);
    wx.showModal({
      title: scenario ? scenario.scenario_name : '情景详情',
      content: scenario ? (scenario.description || '暂无描述') : '',
      showCancel: false
    });
  }
});
