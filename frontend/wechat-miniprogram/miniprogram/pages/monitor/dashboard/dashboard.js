const api = require('../../../utils/api');
const { formatCurrency, formatPercent, formatDate } = require('../../../utils/format');
const { MONITOR_TYPES, SEVERITY_LEVELS } = require('../../../utils/constants');

const getMonitorTypeLabel = (key) => {
  const found = MONITOR_TYPES.find(t => t.key === key);
  return found ? found.label : key;
};

const getSeverityLabel = (key) => {
  const found = SEVERITY_LEVELS.find(s => s.key === key);
  return found ? found.label : key;
};

const getSeverityColor = (key) => {
  const found = SEVERITY_LEVELS.find(s => s.key === key);
  return found ? found.color : '#f39c12';
};

Page({
  data: {
    monitors: [],
    alerts: [],
    unreadCount: 0,
    loading: false,
    showSubscribeGuide: false,
    stats: { normal: 0, warning: 0, high: 0 }
  },

  onLoad() {
    this.checkSubscribeGuide();
    this.loadDashboard();
  },

  onShow() {
    const auth = require('../../../utils/auth');
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.checkSubscribeGuide();
    this.loadDashboard();
  },

  checkSubscribeGuide() {
    const hasSubscribed = wx.getStorageSync('riskAlertSubscribed');
    const guideClosed = wx.getStorageSync('riskAlertGuideClosed');
    this.setData({ showSubscribeGuide: !hasSubscribed && !guideClosed });
  },

  async loadDashboard() {
    this.setData({ loading: true });
    try {
      const [monitorRes, alertRes, unreadRes] = await Promise.allSettled([
        api.get('/monitors'),
        api.get('/alerts?limit=10'),
        api.get('/notifications/unread-count').catch(() => ({ data: { count: 0 } }))
      ]);

      const monitors = monitorRes.status === 'fulfilled' ? (monitorRes.value.data || []) : [];
      const alerts = alertRes.status === 'fulfilled' ? (alertRes.value.data || []).slice(0, 5) : [];
      const unreadCount = unreadRes.status === 'fulfilled' ? (unreadRes.value.data?.count || 0) : 0;

      const normal = monitors.filter(m => m.status === 'active' || m.status === 'normal').length;
      const warning = monitors.filter(m => m.status === 'warning' || m.status === 'triggered').length;
      const high = monitors.filter(m => m.status === 'critical' || m.status === 'high').length;

      const formattedAlerts = alerts.map(a => ({
        ...a,
        severityLabel: getSeverityLabel(a.severity),
        severityColor: getSeverityColor(a.severity),
        triggeredAtFmt: formatDate(a.triggered_at || a.time)
      }));

      const formattedMonitors = monitors.slice(0, 3).map(m => ({
        ...m,
        typeLabel: getMonitorTypeLabel(m.monitor_type)
      }));

      this.setData({
        monitors: formattedMonitors,
        alerts: formattedAlerts,
        unreadCount,
        stats: { normal, warning, high },
        loading: false
      });
    } catch (e) {
      console.error('Load dashboard failed', e);
      this.setData({ loading: false });
    }
  },

  goToRules() {
    wx.navigateTo({ url: '/pages/monitor/rules/rules' });
  },

  goToCreateRule() {
    wx.navigateTo({ url: '/pages/monitor/create/create' });
  },

  goToAlerts() {
    wx.navigateTo({ url: '/pages/monitor/alerts/alerts' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  viewAllAlerts() {
    wx.navigateTo({ url: '/pages/monitor/alerts/alerts' });
  },

  closeSubscribeGuide() {
    wx.setStorageSync('riskAlertGuideClosed', true);
    this.setData({ showSubscribeGuide: false });
  },

  onSubscribeGuideTap() {
    wx.requestSubscribeMessage({
      tmplIds: ['RISK_ALERT_TEMPLATE_ID'],
      success: (res) => {
        console.log('Subscribe message result', res);
        if (res['RISK_ALERT_TEMPLATE_ID'] === 'accept') {
          wx.setStorageSync('riskAlertSubscribed', true);
        }
      },
      fail: (err) => {
        console.error('Subscribe message failed', err);
      },
      complete: () => {
        wx.setStorageSync('riskAlertGuideClosed', true);
        this.setData({ showSubscribeGuide: false });
      }
    });
  }
});
