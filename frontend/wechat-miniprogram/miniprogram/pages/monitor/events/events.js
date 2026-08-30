Page({
  data: {
    events: [],
    loading: false,
  },

  onLoad() {
    this.loadEvents();
  },

  onPullDownRefresh() {
    this.loadEvents().finally(() => wx.stopPullDownRefresh());
  },

  async loadEvents() {
    this.setData({ loading: true });
    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBaseUrl}/risk-events`,
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      if (res.data && res.data.success) {
        this.setData({ events: res.data.data.list || [] });
      }
    } catch (e) {
      console.error('load risk events failed', e);
    }
    this.setData({ loading: false });
  },

  async acknowledge(e) {
    const { id } = e.currentTarget.dataset;
    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBaseUrl}/risk-events/${id}/acknowledge`,
        method: 'POST',
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      if (res.data && res.data.success) {
        this.loadEvents();
      }
    } catch (e) {
      console.error('acknowledge failed', e);
    }
  },
});
