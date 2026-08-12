const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

const DEFAULT_SHOCKS = { equity: -10, bond: -5, fx: 0, commodity: 0 };

Page({
  data: {
    portfolioId: '',
    scenarioId: '',
    scenarios: [],
    scenarioIndex: 0,
    loading: false,
    customShocks: { ...DEFAULT_SHOCKS }
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    this.setData({
      portfolioId: options.portfolioId || '',
      scenarioId: options.scenarioId || ''
    });
    this.loadScenarios();
  },

  async loadScenarios() {
    try {
      const res = await api.get('/stress/scenarios');
      const scenarios = res.data || [];
      let scenarioIndex = 0;
      if (this.data.scenarioId) {
        const idx = scenarios.findIndex(s => s.scenario_id === this.data.scenarioId || s.id === this.data.scenarioId);
        if (idx >= 0) scenarioIndex = idx;
      }
      const selected = scenarios[scenarioIndex] || {};
      const shocks = selected.shocks || { ...DEFAULT_SHOCKS };
      this.setData({ scenarios, scenarioIndex, customShocks: shocks });
    } catch (e) {
      console.error('Load scenarios failed', e);
      wx.showToast({ title: '加载情景失败', icon: 'none' });
    }
  },

  onScenarioChange(e) {
    const scenarioIndex = e.detail.value;
    const selected = this.data.scenarios[scenarioIndex] || {};
    const shocks = selected.shocks || { ...DEFAULT_SHOCKS };
    this.setData({ scenarioIndex, customShocks: shocks });
  },

  onCustomShock(e) {
    const field = e.currentTarget.dataset.field;
    const value = parseFloat(e.detail.value);
    this.setData({ [`customShocks.${field}`]: isNaN(value) ? 0 : value });
  },

  async runStressTest() {
    const { portfolioId, scenarios, scenarioIndex, customShocks } = this.data;
    if (!portfolioId) {
      wx.showToast({ title: '请先选择组合', icon: 'none' });
      return;
    }
    const scenario = scenarios[scenarioIndex] || {};

    this.setData({ loading: true });
    try {
      const payload = {
        portfolio_id: portfolioId,
        scenario_id: scenario.id || scenario.scenario_id || 'custom',
        shocks: customShocks
      };
      const res = await api.post('/stress/test', payload);
      wx.navigateTo({
        url: `/pages/stress/result/result?data=${encodeURIComponent(JSON.stringify(res.data))}`
      });
    } catch (e) {
      wx.showToast({ title: '测试失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
