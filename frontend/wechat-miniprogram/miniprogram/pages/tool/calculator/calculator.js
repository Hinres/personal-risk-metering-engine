const api = require('../../../utils/api');
const { VAR_METHODS, CONFIDENCE_OPTIONS, HORIZON_OPTIONS } = require('../../../utils/constants');

Page({
  data: {
    holdings: [{ symbol: '', quantity: '', cost_price: '' }],
    methodIndex: 0,
    confidenceIndex: 0,
    horizonIndex: 0,
    result: null,
    loading: false,
    VAR_METHODS,
    CONFIDENCE_OPTIONS,
    HORIZON_OPTIONS
  },

  onMethodChange(e) {
    this.setData({ methodIndex: parseInt(e.detail.value, 10) });
  },

  onConfidenceChange(e) {
    this.setData({ confidenceIndex: parseInt(e.detail.value, 10) });
  },

  onHorizonChange(e) {
    this.setData({ horizonIndex: parseInt(e.detail.value, 10) });
  },

  onHoldingInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const holdings = this.data.holdings.slice();
    holdings[index][field] = e.detail.value;
    this.setData({ holdings });
  },

  addHolding() {
    this.setData({ holdings: [...this.data.holdings, { symbol: '', quantity: '', cost_price: '' }] });
  },

  removeHolding(e) {
    const index = e.currentTarget.dataset.index;
    const holdings = this.data.holdings.slice();
    if (holdings.length <= 1) return;
    holdings.splice(index, 1);
    this.setData({ holdings });
  },

  validate() {
    const holdings = this.data.holdings.filter(h => h.symbol.trim() && h.quantity.trim());
    if (holdings.length === 0) return '请至少填写一条有效持仓';
    return null;
  },

  async calculate() {
    const error = this.validate();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const payload = {
      method: VAR_METHODS[this.data.methodIndex].key,
      confidence_level: CONFIDENCE_OPTIONS[this.data.confidenceIndex].key,
      time_horizon: HORIZON_OPTIONS[this.data.horizonIndex].key,
      holdings: this.data.holdings.map(h => ({
        symbol: h.symbol.trim(),
        quantity: Number(h.quantity),
        cost_price: h.cost_price ? Number(h.cost_price) : 0
      }))
    };

    this.setData({ loading: true });
    try {
      const res = await api.post('/tools/var-calc', payload);
      this.setData({ result: res.data || res, loading: false });
    } catch (e) {
      console.error('Tool VaR calculation failed', e);
      wx.showToast({ title: e.message || '计算失败', icon: 'none' });
      this.setData({ loading: false });
    }
  }
});
