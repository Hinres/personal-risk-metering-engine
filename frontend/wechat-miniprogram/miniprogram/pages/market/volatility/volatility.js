Page({
  data: {
    summary: null,
    loading: false,
  },

  onLoad() {
    this.loadVolatility();
  },

  onPullDownRefresh() {
    this.loadVolatility().finally(() => wx.stopPullDownRefresh());
  },

  async loadVolatility() {
    this.setData({ loading: true });
    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBaseUrl}/market/volatility`,
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      if (res.data && res.data.success) {
        this.setData({ summary: res.data.data });
      }
    } catch (e) {
      console.error('load volatility failed', e);
    }
    this.setData({ loading: false });
  },
});
