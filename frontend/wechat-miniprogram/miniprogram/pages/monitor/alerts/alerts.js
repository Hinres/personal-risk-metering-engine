const api = require('../../../utils/api');
const { formatDate, getRiskColor } = require('../../../utils/format');

const SEVERITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急'
};

Page({
  data: {
    alerts: [],
    loading: false,
    refreshing: false,
    error: false,
    errorMsg: ''
  },

  onLoad() {
    this.loadAlerts();
  },

  onShow() {
    this.loadAlerts();
  },

  async loadAlerts() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get('/alerts');
      const alerts = (res.data || []).map(a => {
        const id = a.id || a.alert_id;
        return {
          ...a,
          id,
          triggeredAtFmt: formatDate(a.triggered_at || a.created_at),
          severityLabel: SEVERITY_LABELS[a.severity] || a.severity,
          severityColor: getRiskColor(a.severity)
        };
      });
      this.setData({ alerts, loading: false, refreshing: false });
    } catch (e) {
      console.error('Load alerts failed', e);
      this.setData({
        loading: false,
        refreshing: false,
        error: true,
        errorMsg: e.message || '加载失败，请稍后重试'
      });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadAlerts();
  },

  onRetry() {
    this.loadAlerts();
  }
});
