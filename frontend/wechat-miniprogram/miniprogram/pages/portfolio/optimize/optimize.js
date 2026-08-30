const api = require('../../../../utils/api');
const auth = require('../../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    loading: false,
    consentChecked: false,
    optimization: null,
    error: false,
    errorMsg: '',
  },

  onLoad(options) {
    auth.requireLogin();
    auth.requireRiskAck();
    this.setData({ portfolioId: options.id || '' });
  },

  onConsentChange(e) {
    this.setData({ consentChecked: e.detail.value });
  },

  async loadOptimization() {
    if (!this.data.consentChecked) {
      wx.showToast({ title: '请先确认风险提示', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get(`/portfolios/${this.data.portfolioId}/optimize?consent_confirmed=true`);
      this.setData({ optimization: res.data, loading: false });
    } catch (e) {
      console.error('load optimization failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  onRetry() {
    this.loadOptimization();
  },
});
