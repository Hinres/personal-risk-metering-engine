const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    portfolioId: '',
    symbol: '',
    market: '',
    quantity: '',
    costPrice: '',
    purchaseDate: '',
    remark: '',
    loading: false,
    error: false,
    errorMessage: ''
  },

  onLoad(options) {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.setData({ portfolioId: options.portfolioId });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ purchaseDate: e.detail.value });
  },

  resetError() {
    this.setData({ error: false, errorMessage: '' });
  },

  async addHolding() {
    this.resetError();
    const { portfolioId, symbol, market, quantity, costPrice, purchaseDate, remark } = this.data;
    if (!symbol.trim()) {
      wx.showToast({ title: '请输入标的代码', icon: 'none' });
      return;
    }
    if (!market.trim()) {
      wx.showToast({ title: '请输入市场', icon: 'none' });
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      wx.showToast({ title: '数量必须大于0', icon: 'none' });
      return;
    }
    if (costPrice === '' || parseFloat(costPrice) < 0) {
      wx.showToast({ title: '成本价不能为负', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await api.post(`/holdings/portfolio/${portfolioId}`, {
        symbol: symbol.trim().toUpperCase(),
        market: market.trim(),
        quantity: parseFloat(quantity),
        cost_price: parseFloat(costPrice),
        purchase_date: purchaseDate || undefined,
        remark: remark.trim() || undefined
      });
      wx.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      this.setData({ error: true, errorMessage: e.message || '添加失败' });
      wx.showToast({ title: e.message || '添加失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
