const api = require('../../../../../../utils/api');
const auth = require('../../../../../../utils/auth');

Page({
  data: {
    id: '',
    name: '',
    description: '',
    loading: false,
    submitting: false,
  },

  onLoad(options) {
    auth.requireLogin();
    auth.requireRiskAck();
    this.setData({ id: options.id || '' });
    this.loadTemplate();
  },

  async loadTemplate() {
    this.setData({ loading: true });
    try {
      const res = await api.get(`/portfolio-templates/${this.data.id}`);
      const t = res.data || {};
      this.setData({ name: t.name ? `${t.name} 副本` : '', description: t.description || '', loading: false });
    } catch (e) {
      console.error('load template failed', e);
      this.setData({ loading: false });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },

  async apply() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入组合名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await api.post('/portfolios/from-template', {
        template_id: this.data.id,
        name: this.data.name.trim(),
        description: this.data.description.trim(),
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/portfolio/detail/detail?id=${res.data.portfolio_id}` });
      }, 1000);
    } catch (e) {
      console.error('apply template failed', e);
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
