Page({
  data: {
    templates: [],
    loading: false,
  },

  onLoad() {
    this.loadTemplates();
  },

  async loadTemplates() {
    this.setData({ loading: true });
    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBaseUrl}/portfolio-templates`,
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      if (res.data && res.data.success) {
        this.setData({ templates: res.data.data.list || [] });
      }
    } catch (e) {
      console.error('load templates failed', e);
    }
    this.setData({ loading: false });
  },

  onTemplateTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/portfolio/templates/detail/detail?id=${id}` });
  },

  onApplyTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/portfolio/templates/apply/apply?id=${id}` });
  },
});
