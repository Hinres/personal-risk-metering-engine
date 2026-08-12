// components/risk-chart/risk-chart.js
Component({
  properties: {
    type: { type: String, value: 'bar' }, // distribution | bar | pie | trend
    data: { type: Array, value: [] },
    title: { type: String, value: '' },
    canvasId: { type: String, value: 'riskChart' },
    height: { type: Number, value: 300 } // rpx
  },
  observers: {
    'data': function(data) {
      if (data && data.length) {
        this.draw();
      }
    }
  },
  lifetimes: {
    ready() {
      this.draw();
    }
  },
  methods: {
    draw() {
      const { type, data, canvasId, height } = this.properties;
      if (!data || !data.length) return;
      const query = wx.createSelectorQuery().in(this);
      query.select(`#${canvasId}`).fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width * dpr;
        const canvasHeight = (height / 750) * wx.getSystemInfoSync().windowWidth * dpr;
        canvas.width = width;
        canvas.height = canvasHeight;
        ctx.scale(dpr, dpr);
        const displayWidth = width / dpr;
        const displayHeight = canvasHeight / dpr;
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        if (type === 'distribution') this.drawDistribution(ctx, data, displayWidth, displayHeight);
        else if (type === 'bar') this.drawBar(ctx, data, displayWidth, displayHeight);
        else if (type === 'pie') this.drawPie(ctx, data, displayWidth, displayHeight);
        else if (type === 'trend') this.drawTrend(ctx, data, displayWidth, displayHeight);
      });
    },

    drawDistribution(ctx, data, w, h) {
      const padding = 30;
      const chartW = w - padding * 2;
      const chartH = h - padding * 2 - 20;
      const max = Math.max(...data.map(d => d.count || d.frequency || d.value || 0));
      const barW = chartW / data.length * 0.7;
      const gap = chartW / data.length * 0.3;
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(padding, h - padding, chartW, 1);
      data.forEach((d, i) => {
        const val = d.count || d.frequency || d.value || 0;
        const barH = max > 0 ? (val / max) * chartH : 0;
        const x = padding + i * (barW + gap) + gap / 2;
        const y = h - padding - barH;
        ctx.fillStyle = '#3498db';
        ctx.fillRect(x, y, barW, barH);
      });
    },

    drawBar(ctx, data, w, h) {
      const padding = 30;
      const chartW = w - padding * 2;
      const chartH = h - padding * 2 - 20;
      const max = Math.max(...data.map(d => Math.abs(d.value || d.contribution || 0)));
      const barH = Math.min(32, chartH / data.length * 0.6);
      const gap = chartH / data.length * 0.4;
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(padding, h - padding, chartW, 1);
      data.forEach((d, i) => {
        const val = Math.abs(d.value || d.contribution || 0);
        const bw = max > 0 ? (val / max) * chartW : 0;
        const y = padding + i * (barH + gap) + gap / 2;
        ctx.fillStyle = d.color || '#3498db';
        ctx.fillRect(padding, y, bw, barH);
        ctx.fillStyle = '#2c3e50';
        ctx.font = '12px sans-serif';
        ctx.fillText(d.label || d.symbol || '', padding, y - 4);
      });
    },

    drawPie(ctx, data, w, h) {
      const total = data.reduce((sum, d) => sum + Math.abs(d.value || d.weight || 0), 0);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 30;
      let start = -Math.PI / 2;
      const colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];
      data.forEach((d, i) => {
        const val = Math.abs(d.value || d.weight || 0);
        const angle = total > 0 ? (val / total) * Math.PI * 2 : 0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = d.color || colors[i % colors.length];
        ctx.fill();
        start += angle;
      });
    },

    drawTrend(ctx, data, w, h) {
      const padding = 30;
      const chartW = w - padding * 2;
      const chartH = h - padding * 2 - 20;
      const values = data.map(d => d.value || d.var_value || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * chartW;
        const y = h - padding - ((d.value - min) / range) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
});
