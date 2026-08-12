const api = require('../../../utils/api');
const { INVESTMENT_GOALS, RISK_LEVELS } = require('../../../utils/constants');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    portfolio: null,
    name: '',
    description: '',
    investmentGoals: INVESTMENT_GOALS,
    riskLevels: RISK_LEVELS,
    investmentGoalIndex: 0,
    riskLevelIndex: 0,
    loading: false,
    saving: false,
    error: false,
    errorMessage: ''
  },

  onLoad(options) {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.setData({ portfolioId: options.id });
    this.loadPortfolio(options.id);
  },

  async loadPortfolio(id) {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get(`/portfolios/${id}`);
      const p = res.data || {};
      const investmentGoalIndex = Math.max(0, INVESTMENT_GOALS.findIndex(g => g.key === p.investment_goal));
      const riskLevelIndex = Math.max(0, RISK_LEVELS.findIndex(r => r.key === p.risk_level));
      this.setData({
        portfolio: p,
        name: p.name || '',
        description: p.description || '',
        investmentGoalIndex,
        riskLevelIndex,
        error: false,
        errorMessage: ''
      });
    } catch (e) {
      console.error('Load portfolio failed', e);
      this.setData({ error: true, errorMessage: e.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRetry() {
    this.loadPortfolio(this.data.portfolioId);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onGoalChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ investmentGoalIndex: index });
  },

  onRiskChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ riskLevelIndex: index });
  },

  async savePortfolio() {
    const { portfolioId, name, description, investmentGoals, riskLevels, investmentGoalIndex, riskLevelIndex } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请输入组合名称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await api.put(`/portfolios/${portfolioId}`, {
        name: name.trim(),
        description: description.trim(),
        investment_goal: investmentGoals[investmentGoalIndex].key,
        risk_level: riskLevels[riskLevelIndex].key
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
