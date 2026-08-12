const api = require('../../utils/api');

Page({
  data: {
    symbol: '',
    name: '',
    methods: [],
    methodNames: [],
    methodIndex: 0,
    inputs: {},
    result: null,
    loading: false,
    calculating: false,
    valuationJudgment: '',
    judgmentColor: '#7f8c8d',
    chartData: []
  },

  onLoad(options) {
    const symbol = options.symbol || '';
    const name = decodeURIComponent(options.name || '');
    this.setData({ symbol, name });
    this.loadMethods();
  },

  onReady() {
    this.drawValuationChart();
  },

  async loadMethods() {
    try {
      const res = await api.get('/valuation/methods');
      const methods = res.data || [];
      this.setData({
        methods,
        methodNames: methods.map(m => m.name)
      });
    } catch (e) {
      console.error('Load methods failed', e);
      wx.showToast({ title: '加载方法失败', icon: 'none' });
    }
  },

  onMethodChange(e) {
    this.setData({ methodIndex: e.detail.value });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({ [`inputs.${field}`]: value });
  },

  async calculate() {
    const { symbol, methods, methodIndex, inputs } = this.data;
    const method = methods[methodIndex];
    if (!method) {
      wx.showToast({ title: '请选择估值方法', icon: 'none' });
      return;
    }

    this.setData({ calculating: true });
    try {
      const res = await api.post('/valuation/calculate', {
        symbol,
        method: method.code || method.id,
        inputs
      });
      const result = res.data || null;
      this.setData({ result });
      this.computeValuationJudgment(result);
      this.prepareChartData(result);
      this.drawValuationChart();
    } catch (e) {
      console.error('Calculate valuation failed', e);
      // 增强 error 响应处理：解析后端返回的具体错误信息
      const errorMsg = (e.message || '计算失败');
      wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
    } finally {
      this.setData({ calculating: false });
    }
  },

  computeValuationJudgment(result) {
    if (!result) return;
    let judgment = '';
    let color = '#7f8c8d';

    // PEG method has explicit valuation
    if (result.valuation) {
      const map = { undervalued: '低估', fair: '合理', overvalued: '高估' };
      judgment = map[result.valuation] || result.valuation;
      color = result.valuation === 'undervalued' ? '#27ae60' : result.valuation === 'overvalued' ? '#e74c3c' : '#f39c12';
    } else if (result.intrinsic_value && result.range_low && result.range_high) {
      // Generic: compare intrinsic value to range (if we had current price, we'd compare)
      // For now, show range-based assessment
      const iv = parseFloat(result.intrinsic_value);
      const low = parseFloat(result.range_low);
      const high = parseFloat(result.range_high);
      if (iv < low * 0.95) {
        judgment = '显著低估';
        color = '#27ae60';
      } else if (iv > high * 1.05) {
        judgment = '显著高估';
        color = '#e74c3c';
      } else {
        judgment = '估值合理';
        color = '#f39c12';
      }
    }

    this.setData({ valuationJudgment: judgment, judgmentColor: color });
  },

  prepareChartData(result) {
    if (!result) return;
    const data = [];

    // PE chart data
    if (result.industry_pe || result.historical_pe || result.growth_adjusted) {
      if (result.industry_pe) data.push({ label: '行业PE', value: result.industry_pe.intrinsic_value });
      if (result.historical_pe) data.push({ label: '历史PE', value: result.historical_pe.intrinsic_value });
      if (result.growth_adjusted) data.push({ label: '增长调整', value: result.growth_adjusted.intrinsic_value });
      if (result.summary) data.push({ label: '综合', value: result.summary.mean_value, highlight: true });
    }

    // PB chart data
    if (result.industry_pb || result.historical_pb || result.roe_adjusted) {
      if (result.industry_pb) data.push({ label: '行业PB', value: result.industry_pb.intrinsic_value });
      if (result.historical_pb) data.push({ label: '历史PB', value: result.historical_pb.intrinsic_value });
      if (result.roe_adjusted) data.push({ label: 'ROE调整', value: result.roe_adjusted.intrinsic_value });
      if (result.summary) data.push({ label: '综合', value: result.summary.mean_value, highlight: true });
    }

    // DCF forecast period
    if (result.forecast_period && result.forecast_period.length > 0) {
      result.forecast_period.forEach((p, i) => {
        data.push({ label: `第${i+1}年`, value: p.pv, isForecast: true });
      });
    }

    // DDM dividend forecast
    if (result.dividend_forecast && result.dividend_forecast.length > 0) {
      result.dividend_forecast.forEach((d, i) => {
        data.push({ label: `Y${d.year}`, value: d.pv, isForecast: true });
      });
    }

    // PEG
    if (result.method === 'peg') {
      data.push({ label: '合理价值', value: result.intrinsic_value, highlight: true });
      data.push({ label: '当前隐含', value: result.current_implied_price });
    }

    this.setData({ chartData: data });
  },

  drawValuationChart() {
    const { chartData } = this.data;
    if (!chartData || chartData.length === 0) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('#valuationChart').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = res[0].width * dpr;
      const height = res[0].height * dpr;
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);

      const padding = 20;
      const chartW = res[0].width - padding * 2;
      const chartH = res[0].height - padding * 2 - 20;
      const barW = Math.max(20, (chartW / chartData.length) * 0.6);
      const spacing = chartW / chartData.length;

      const maxVal = Math.max(...chartData.map(d => d.value || 0));
      const minVal = Math.min(...chartData.map(d => d.value || 0));
      const range = maxVal - minVal || 1;

      ctx.clearRect(0, 0, res[0].width, res[0].height);

      // Draw bars
      chartData.forEach((d, i) => {
        const val = d.value || 0;
        const barH = ((val - minVal) / range) * chartH * 0.8 + chartH * 0.1;
        const x = padding + i * spacing + (spacing - barW) / 2;
        const y = res[0].height - padding - 20 - barH;

        const color = d.highlight ? '#2c3e50' : (d.isForecast ? '#3498db' : '#7f8c8d');
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barW, barH);

        // Label
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x + barW / 2, res[0].height - 6);

        // Value
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(val.toFixed(1), x + barW / 2, y - 4);
      });
    });
  },

  goToHistory() {
    const { symbol, methods, methodIndex } = this.data;
    const method = methods[methodIndex];
    const methodParam = method ? `&method=${method.code || method.id}` : '';
    wx.navigateTo({
      url: `/pages/valuation/history/history?stock_id=${symbol}${methodParam}`
    });
  }
});
