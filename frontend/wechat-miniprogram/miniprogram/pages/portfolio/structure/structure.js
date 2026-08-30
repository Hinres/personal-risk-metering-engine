Page({
  data: {
    portfolioId: '',
    structure: null,
    loading: false,
    error: false,
    errorMsg: '',
  },

  onLoad(options) {
    this.setData({ portfolioId: options.id || '' });
    if (this.data.portfolioId) {
      this.loadStructure();
    }
  },

  async loadStructure() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBaseUrl}/portfolios/${this.data.portfolioId}/structure`,
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      if (res.data && res.data.success) {
        this.setData({ structure: res.data.data, loading: false });
      } else {
        throw new Error((res.data && res.data.message) || '加载失败');
      }
    } catch (e) {
      console.error('load structure failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  onRetry() {
    this.loadStructure();
  },
});
