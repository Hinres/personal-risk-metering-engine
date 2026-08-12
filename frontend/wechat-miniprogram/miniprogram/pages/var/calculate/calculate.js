const api = require('../../../utils/api');
const constants = require('../../../utils/constants');
const auth = require('../../../utils/auth');

const methodLabels = constants.VAR_METHODS.map(m => m.label);
const confidenceLabels = constants.CONFIDENCE_OPTIONS.map(c => c.label);
const horizonLabels = constants.HORIZON_OPTIONS.map(h => h.label);
const estimationLabels = constants.EVT_ESTIMATION_METHODS.map(e => e.label);

Page({
  data: {
    portfolios: [],
    portfolioNames: [],
    portfolioIndex: 0,
    portfolioId: '',

    methods: methodLabels,
    methodIndex: 0,

    confidenceMode: 'quick',
    confidenceIndex: 0,
    confidenceInput: '',

    horizonMode: 'quick',
    horizonIndex: 0,
    horizonInput: '',

    showEstimation: false,
    estimationMethods: estimationLabels,
    estimationIndex: 0,

    loading: false
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
    this.loadPortfolios();
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
  },

  async loadPortfolios() {
    try {
      const res = await api.get('/portfolios');
      const portfolios = res.data || [];
      const portfolioNames = portfolios.map(p => p.name || '未命名组合');
      let portfolioIndex = 0;
      if (this.data.portfolioId) {
        const idx = portfolios.findIndex(p => p.portfolio_id === this.data.portfolioId);
        if (idx >= 0) portfolioIndex = idx;
      }
      this.setData({ portfolios, portfolioNames, portfolioIndex });
    } catch (e) {
      console.error('Load portfolios failed', e);
      wx.showToast({ title: '加载组合失败', icon: 'none' });
    }
  },

  onPortfolioChange(e) {
    this.setData({ portfolioIndex: e.detail.value });
  },

  onMethodChange(e) {
    const index = e.detail.value;
    const method = constants.VAR_METHODS[index].key;
    this.setData({
      methodIndex: index,
      showEstimation: method === 'extreme_value'
    });
  },

  switchConfidenceMode(e) {
    this.setData({ confidenceMode: e.currentTarget.dataset.mode, confidenceInput: '' });
  },

  onConfidenceChange(e) {
    this.setData({ confidenceIndex: e.detail.value });
  },

  onConfidenceInput(e) {
    this.setData({ confidenceInput: e.detail.value });
  },

  switchHorizonMode(e) {
    this.setData({ horizonMode: e.currentTarget.dataset.mode, horizonInput: '' });
  },

  onHorizonChange(e) {
    this.setData({ horizonIndex: e.detail.value });
  },

  onHorizonInput(e) {
    this.setData({ horizonInput: e.detail.value });
  },

  onEstimationChange(e) {
    this.setData({ estimationIndex: e.detail.value });
  },

  getConfidenceLevel() {
    if (this.data.confidenceMode === 'quick') {
      return constants.CONFIDENCE_OPTIONS[this.data.confidenceIndex].key;
    }
    const val = parseFloat(this.data.confidenceInput);
    if (isNaN(val) || val < 90.00 || val > 99.99) {
      return null;
    }
    return val / 100;
  },

  getTimeHorizon() {
    if (this.data.horizonMode === 'quick') {
      return constants.HORIZON_OPTIONS[this.data.horizonIndex].key;
    }
    const val = parseInt(this.data.horizonInput, 10);
    if (isNaN(val) || val < 1 || val > 365) {
      return null;
    }
    return val;
  },

  validate() {
    const { portfolios, portfolioIndex } = this.data;
    if (!portfolios.length || !portfolios[portfolioIndex]) {
      wx.showToast({ title: '请选择组合', icon: 'none' });
      return false;
    }
    if (this.getConfidenceLevel() === null) {
      wx.showToast({ title: '请输入 90.00%–99.99% 之间的置信度', icon: 'none' });
      return false;
    }
    if (this.getTimeHorizon() === null) {
      wx.showToast({ title: '请输入 1–365 天之间的时间周期', icon: 'none' });
      return false;
    }
    return true;
  },

  async calculateVaR() {
    if (!this.validate()) return;

    const { portfolios, portfolioIndex, methodIndex, showEstimation, estimationIndex } = this.data;
    const portfolio = portfolios[portfolioIndex];
    const method = constants.VAR_METHODS[methodIndex].key;

    const payload = {
      portfolio_id: portfolio.portfolio_id,
      confidence_level: this.getConfidenceLevel(),
      time_horizon: this.getTimeHorizon(),
      method: method
    };

    if (showEstimation) {
      payload.estimation_method = constants.EVT_ESTIMATION_METHODS[estimationIndex].key;
    }

    this.setData({ loading: true });
    try {
      const res = await api.post('/var/calculate', payload);
      const result = res.data || {};
      const query = `data=${encodeURIComponent(JSON.stringify(result))}` +
        `&varId=${result.var_id || result.id || ''}` +
        `&portfolioId=${portfolio.portfolio_id}`;
      wx.navigateTo({
        url: `/pages/var/result/result?${query}`
      });
    } catch (e) {
      wx.showToast({ title: '计算失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
