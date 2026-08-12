const api = require('../../../utils/api');
const { formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    holdingId: '',
    portfolioId: '',
    holding: null,
    symbol: '',
    market: '',
    quantity: '',
    costPrice: '',
    purchaseDate: '',
    remark: '',
    loading: false,
    saving: false,
    deleting: false,
    error: false,
    errorMessage: ''
  },

  onLoad(options) {
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.setData({ holdingId: options.id, portfolioId: options.portfolioId });
    this.loadHolding(options.id);
  },

  async loadHolding(id) {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get(`/holdings/${id}`);
      const h = res.data || {};
      this.setData({
        holding: h,
        symbol: h.symbol || '',
        market: h.market || '',
        quantity: h.quantity !== undefined ? String(h.quantity) : '',
        costPrice: h.cost_price !== undefined ? String(h.cost_price) : '',
        purchaseDate: formatDate(h.purchase_date),
        remark: h.remark || '',
        error: false,
        errorMessage: ''
      });
    } catch (e) {
      console.error('Load holding failed', e);
      this.setData({ error: true, errorMessage: e.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRetry() {
    this.loadHolding(this.data.holdingId);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ purchaseDate: e.detail.value });
  },

  async saveHolding() {
    const { holdingId, quantity, costPrice, purchaseDate, remark } = this.data;
    if (quantity === '' || parseFloat(quantity) <= 0) {
      wx.showToast({ title: '数量必须大于0', icon: 'none' });
      return;
    }
    if (costPrice === '' || parseFloat(costPrice) < 0) {
      wx.showToast({ title: '成本价不能为负', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await api.put(`/holdings/${holdingId}`, {
        quantity: parseFloat(quantity),
        cost_price: parseFloat(costPrice),
        purchase_date: purchaseDate || undefined,
        remark: remark.trim() || undefined
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  deleteHolding() {
    wx.showModal({
      title: '确认删除',
      content: '确定删除该持仓吗？删除后不可恢复。',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        wx.showLoading({ title: '删除中' });
        try {
          await api.del(`/holdings/${this.data.holdingId}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        } finally {
          this.setData({ deleting: false });
          wx.hideLoading();
        }
      }
    });
  }
});
