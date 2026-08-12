const api = require('../../../utils/api');

Page({
  data: {
    name: '',
    description: '',
    type: 'stock',
    types: [
      { label: '股票组合', value: 'stock' },
      { label: '债券组合', value: 'bond' },
      { label: '混合组合', value: 'mixed' },
      { label: '基金组合', value: 'fund' },
      { label: '加密货币', value: 'crypto' },
      { label: '自定义', value: 'custom' }
    ],
    typeIndex: 0,
    loading: false
  },

  onInputName(e) {
    this.setData({ name: e.detail.value });
  },

  onInputDescription(e) {
    this.setData({ description: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ typeIndex: e.detail.value, type: this.data.types[e.detail.value].value });
  },

  async createPortfolio() {
    const { name, type, description } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请输入组合名称', icon: 'none' });
      return;
    }
    if (name.length > 100) {
      wx.showToast({ title: '名称不超过100字符', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      await api.post('/portfolios', { name: name.trim(), type, description });
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});