const { formatCurrency, formatPercent } = require('../../../utils/format');

Page({
  data: {
    scenarioName: '',
    portfolioLoss: '--',
    lossPercent: '--',
    lossColor: '#e74c3c',
    shockedValues: [],
    details: [],
    loading: false
  },

  onLoad(options) {
    if (options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data));
        this.setData({
          scenarioName: data.scenario_name || '压力测试',
          portfolioLoss: formatCurrency(data.portfolio_loss),
          lossPercent: formatPercent(data.loss_percentage),
          lossColor: data.loss_percentage > 0.1 ? '#e74c3c' : data.loss_percentage > 0.05 ? '#f39c12' : '#27ae60',
          shockedValues: (data.shocked_values || []).map(s => ({
            ...s,
            shocked_value_fmt: formatCurrency(s.shocked_value),
            change_fmt: formatPercent(s.change_percentage / 100),
            changeColor: s.change_percentage < 0 ? '#e74c3c' : '#27ae60'
          })),
          details: [
            { label: '情景类型', value: data.scenario_type || '自定义' },
            { label: '冲击参数', value: JSON.stringify(data.shocks || {}) },
            { label: ' VaR 对比', value: formatCurrency(data.var_comparison || 0) }
          ]
        });
      } catch (e) {
        console.error('Parse stress result failed', e);
      }
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
