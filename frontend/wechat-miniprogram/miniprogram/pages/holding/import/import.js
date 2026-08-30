Page({
  data: {
    portfolioId: '',
    loading: false,
    result: null,
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolio_id || '' });
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'csv'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.uploadFile(file);
      },
    });
  },

  uploadFile(file) {
    this.setData({ loading: true });
    wx.uploadFile({
      url: `${getApp().globalData.apiBaseUrl}/portfolios/${this.data.portfolioId}/holdings/import`,
      filePath: file.path,
      name: 'file',
      header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          this.setData({ result: data.data, loading: false });
        } catch (e) {
          wx.showToast({ title: '解析失败', icon: 'none' });
          this.setData({ loading: false });
        }
      },
      fail: () => {
        wx.showToast({ title: '上传失败', icon: 'none' });
        this.setData({ loading: false });
      },
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
