const api = require('../../../../../../utils/api');
const auth = require('../../../../../../utils/auth');

Page({
  data: {
    id: '',
    template: null,
    loading: false,
    error: false,
    errorMsg: '',
  },

  onLoad(options) {
    auth.requireLogin();
    auth.requireRiskAck();
    this.setData({ id: options.id || '' });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get(`/portfolio-templates/${this.data.id}`);
      this.setData({ template: res.data, loading: false });
    } catch (e) {
      console.error('load template detail failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  onRetry() {
    this.loadDetail();
  },

  goToApply() {
    wx.navigateTo({ url: `/pages/portfolio/templates/apply?id=${this.data.id}` });
  },
});
