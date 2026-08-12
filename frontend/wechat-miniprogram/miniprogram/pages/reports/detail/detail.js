const api = require('../../../utils/api');
const { formatDate } = require('../../../utils/format');
const auth = require('../../../utils/auth');

Page({
  data: {
    report: null,
    loading: false,
    error: '',
    errorMsg: '',
    exporting: false
  },

  onShow() {
    auth.requireLogin();
    auth.requireRiskAck();
  },

  onLoad(options) {
    if (options.id) {
      this.loadReport(options.id);
    } else {
      this.setData({ error: '缺少报告 ID', errorMsg: '无法加载报告详情' });
    }
  },

  onRetry() {
    if (this.data.report) {
      this.loadReport(this.data.report.report_id);
    }
  },

  async loadReport(id) {
    this.setData({ loading: true, error: '', errorMsg: '' });
    try {
      const res = await api.get(`/reports/${id}`);
      const report = res.data || {};
      this.setData({
        report: {
          ...report,
          created_at_fmt: formatDate(report.created_at),
          formatLabel: report.format === 'excel' ? 'Excel' : 'PDF',
          typeLabel: this.typeLabel(report.report_type)
        },
        loading: false
      });
    } catch (e) {
      console.error('Load report failed', e);
      this.setData({ error: '加载失败', errorMsg: e.message || '请稍后重试', loading: false });
    }
  },

  typeLabel(key) {
    const map = {
      risk_summary: '风险摘要',
      var_analysis: 'VaR 分析',
      stress_test: '压力测试',
      portfolio_review: '组合回顾',
      compliance: '合规报告'
    };
    return map[key] || key;
  },

  async exportPDF() {
    await this.exportReport('pdf');
  },

  async exportExcel() {
    await this.exportReport('excel');
  },

  async exportReport(format) {
    const { report } = this.data;
    if (!report || !report.report_id) return;
    this.setData({ exporting: true });
    try {
      const res = await api.get(`/reports/${report.report_id}/export?format=${format}`);
      const downloadUrl = res.data?.download_url;
      if (!downloadUrl) {
        wx.showToast({ title: '导出链接为空', icon: 'none' });
        return;
      }
      const downloadRes = await api.download(downloadUrl, `${wx.env.USER_DATA_PATH}/report_${report.report_id}.${format}`);
      wx.showToast({ title: '下载成功', icon: 'success' });
      wx.openDocument({
        filePath: downloadRes.filePath,
        showMenu: true,
        fail: () => {
          wx.showToast({ title: '预览失败', icon: 'none' });
        }
      });
    } catch (e) {
      console.error('Export failed', e);
      wx.showToast({ title: '导出失败', icon: 'none' });
    } finally {
      this.setData({ exporting: false });
    }
  }
});
