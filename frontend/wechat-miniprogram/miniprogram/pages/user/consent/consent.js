const app = getApp();
const api = require('../../../utils/api');

const CONSENT_TYPES = [
  {
    consent_type: 'data_collection',
    label: '数据收集',
    desc: '允许收集您的投资组合、持仓与风险计算数据，以提供风险评估服务。'
  },
  {
    consent_type: 'optimization_advice',
    label: '优化建议',
    desc: '允许基于您的组合数据生成优化建议，该建议不构成投资建议。'
  },
  {
    consent_type: 'marketing',
    label: '营销信息',
    desc: '允许在获得您授权的情况下，向您推送产品更新和营销信息。'
  }
];

Page({
  data: {
    items: [],
    loading: true,
    error: false,
    originType: ''
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ originType: options.type });
    }
    this.loadConsents();
  },

  async loadConsents() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/users/consents');
      const list = res.data || res;
      const grantedMap = {};
      (Array.isArray(list) ? list : []).forEach(c => {
        if (c.is_active) {
          grantedMap[c.consent_type || c.type] = true;
        }
      });
      const items = CONSENT_TYPES.map(t => ({
        ...t,
        granted: !!grantedMap[t.consent_type]
      }));
      this.setData({ items, loading: false, error: false });
    } catch (e) {
      console.error('Load consents failed', e);
      this.setData({ error: true, loading: false });
    }
  },

  async onToggle(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.items[index];
    if (!item) return;
    const nextGranted = !item.granted;
    try {
      if (nextGranted) {
        await api.post('/users/consents', {
          consent_type: item.consent_type,
          granted_via: 'wechat_miniprogram'
        });
      } else {
        await api.del(`/users/consents/${item.consent_type}`);
      }
      app.setConsent(item.consent_type, nextGranted);
      const items = this.data.items.slice();
      items[index].granted = nextGranted;
      this.setData({ items });
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  onDone() {
    if (this.data.originType) {
      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel && eventChannel.emit) {
        eventChannel.emit('consentGranted', { type: this.data.originType });
      }
    }
    wx.navigateBack();
  },

  onRetry() {
    this.loadConsents();
  }
});
