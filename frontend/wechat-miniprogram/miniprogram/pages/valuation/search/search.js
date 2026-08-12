const api = require('../../utils/api');

Page({
  data: {
    keyword: '',
    stocks: [],
    loading: false,
    hasSearched: false
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    const { keyword } = this.data;
    if (!keyword.trim()) {
      wx.showToast({ title: '请输入股票名称或代码', icon: 'none' });
      return;
    }
    this.doSearch(keyword.trim());
  },

  onClear() {
    this.setData({ keyword: '', stocks: [], hasSearched: false });
  },

  async doSearch(keyword) {
    this.setData({ loading: true, hasSearched: true });
    try {
      const res = await api.get('/valuation/stocks/search', { keyword });
      const stocks = res.data || [];
      this.setData({ stocks });
      if (!stocks.length) {
        wx.showToast({ title: '未找到相关股票', icon: 'none' });
      }
    } catch (e) {
      console.error('Search stocks failed', e);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onStockTap(e) {
    const stock = e.currentTarget.dataset.stock;
    wx.navigateTo({
      url: `/pages/valuation/result/result?symbol=${stock.symbol}&name=${encodeURIComponent(stock.name)}`
    });
  },

  goToHistory() {
    wx.navigateTo({ url: '/pages/valuation/history/history' });
  }
});
