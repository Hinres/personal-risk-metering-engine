const app = getApp();
const api = require('../../../utils/api');

Page({
  data: {
    content: '',
    loading: true,
    error: false,
    submitting: false
  },

  onLoad() {
    this.loadRiskHelp();
  },

  async loadRiskHelp() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/system/help', { type: 'risk' });
      const data = res.data || res;
      let content = '';
      if (typeof data.content === 'string') {
        content = data.content;
      } else if (Array.isArray(data.items)) {
        content = data.items.map(i => `${i.title || ''}\n${i.content || ''}`).join('\n\n');
      } else if (Array.isArray(data)) {
        content = data.map(i => `${i.title || ''}\n${i.content || ''}`).join('\n\n');
      } else {
        content = this.fallbackContent();
      }
      this.setData({ content, loading: false, error: false });
    } catch (e) {
      console.warn('Risk help fetch failed, using fallback', e);
      this.setData({ content: this.fallbackContent(), loading: false, error: false });
    }
  },

  fallbackContent() {
    return [
      '投资有风险，入市需谨慎。',
      '本应用提供的风险计量、组合分析、VaR 计算、压力测试、风险监控、报告生成等功能，仅作为辅助风险管理的工具，不构成任何投资建议、投资承诺或对投资结果的保证。',
      '金融市场价格波动可能导致您的投资本金发生亏损，过往业绩与历史数据不代表未来表现。您在使用本应用进行投资决策前，应充分了解相关金融产品的风险特征，并结合自身的财务状况、投资经验及风险承受能力审慎决策。',
      '您可以随时在“设置-明示同意”中管理各项功能授权；若不同意上述风险提示，将无法使用核心功能。'
    ].join('\n\n');
  },

  async onAgree() {
    this.setData({ submitting: true });
    try {
      await api.post('/users/risk-acknowledgment', {});
      app.setRiskAcked(true);
      await app.refreshUserState();
      wx.showToast({ title: '确认成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 800);
    } catch (e) {
      wx.showToast({ title: e.message || '确认失败，请重试', icon: 'none' });
      this.setData({ error: true });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onDecline() {
    wx.showModal({
      title: '风险提示',
      content: '暂不同意将无法使用核心功能，是否退出小程序？',
      confirmText: '退出',
      cancelText: '留在本页',
      success: (res) => {
        if (res.confirm) {
          wx.exitMiniProgram?.() || wx.showToast({ title: '请手动退出', icon: 'none' });
        }
      }
    });
  },

  onRetry() {
    this.loadRiskHelp();
  }
});
