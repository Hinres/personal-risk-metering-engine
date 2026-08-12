const api = require('../../utils/api');

Page({
  data: {
    history: [],
    methods: [],
    methodIndex: 0,
    stockId: '',
    loading: false
  },

  onLoad(options) {
    const stockId = options.stock_id || '';
    const method = options.method || '';
    this.setData({ stockId });
    this.loadMethods().then(() => {
      if (method) {
        const idx = this.data.methods.findIndex(m => (m.code || m.id) === method);
        if (idx >= 0) this.setData({ methodIndex: idx });
      }
      this.loadHistory();
    });
  },

  async loadMethods() {
    try {
      const res = await api.get('/valuation/methods');
      const methods = [{ name: '全部方法', code: '' }, ...(res.data || [])];
      this.setData({ methods });
    } catch (e) {
      console.error('Load methods failed', e);
    }
  },

  onMethodChange(e) {
    this.setData({ methodIndex: e.detail.value });
    this.loadHistory();
  },

  async loadHistory() {
    const { stockId, methods, methodIndex } = this.data;
    const method = methods[methodIndex];
    const methodCode = method ? (method.code || method.id || '') : '';
    const params = {};
    if (stockId) params.stock_id = stockId;
    if (methodCode) params.method = methodCode;

    this.setData({ loading: true });
    try {
      const res = await api.get('/valuation/history', params);
      this.setData({ history: res.data || [] });
    } catch (e) {
      console.error('Load history failed', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRecordTap(e) {
    const record = e.currentTarget.dataset.record;
    const stock = record.stock || {};
    wx.navigateTo({
      url: `/pages/valuation/result/result?symbol=${stock.symbol || ''}&name=${encodeURIComponent(stock.name || '')}`
    });
  }
});
