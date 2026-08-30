const api = require('../../../utils/api');
const { formatCurrency, formatPercent } = require('../../../utils/format');
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
  return found ? found.color : '#7f8c8d';
};

const formatThreshold = (item) => {
  const percentTypes = ['var_percentage', 'drawdown', 'concentration', 'liquidity'];
  if (percentTypes.includes(item.monitor_type)) {
    return formatPercent(item.threshold_value);
  }
  if (item.monitor_type === 'var' || item.monitor_type === 'var_threshold') {
    return formatCurrency(item.threshold_value);
  }
  return item.threshold_value !== undefined ? String(item.threshold_value) : '--';
};

Page({
  data: {
    monitors: [],
    portfolioId: '',
    loading: false,
    refreshing: false,
    error: false,
    errorMsg: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
  },

  onShow() {
    const auth = require('../../../utils/auth');
    if (!auth.requireLogin()) return;
    if (!auth.requireRiskAck()) return;
    this.loadMonitors();
  },

  async loadMonitors() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const params = {};
      if (this.data.portfolioId) params.portfolio_id = this.data.portfolioId;
      const res = await api.get('/monitors', params);
      const monitors = (res.data || []).map(m => {
        const id = m.id || m.monitor_id;
        return {
          ...m,
          id,
          typeLabel: getMonitorTypeLabel(m.monitor_type),
          thresholdFmt: formatThreshold(m),
          severityLabel: getSeverityLabel(m.severity),
          severityColor: getSeverityColor(m.severity),
          statusLabel: m.status === 'active' || m.status === 'normal' ? '运行中' : '已暂停'
        };
      });
      this.setData({ monitors, loading: false, refreshing: false });
    } catch (e) {
      console.error('Load monitors failed', e);
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
    this.loadMonitors();
  },

  onRetry() {
    this.loadMonitors();
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    this.showItemActions(id);
  },

  onItemLongPress(e) {
    const id = e.currentTarget.dataset.id;
    this.showItemActions(id);
  },

  onMenuTap(e) {
    const id = e.currentTarget.dataset.id;
    this.showItemActions(id);
  },

  showItemActions(id) {
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.goToEdit(id);
        } else if (res.tapIndex === 1) {
          this.deleteMonitor(id);
        }
      }
    });
  },

  goToEdit(id) {
    const query = `id=${id}${this.data.portfolioId ? `&portfolioId=${this.data.portfolioId}` : ''}`;
    wx.navigateTo({ url: `/pages/monitor/create/create?${query}` });
  },

  deleteMonitor(id) {
    wx.showModal({
      title: '删除规则',
      content: '删除后该规则将不再触发预警，是否继续？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.del(`/monitors/${id}`);
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.loadMonitors();
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  goToCreate() {
    const url = this.data.portfolioId
      ? `/pages/monitor/create/create?portfolioId=${this.data.portfolioId}`
      : '/pages/monitor/create/create';
    wx.navigateTo({ url });
  }
});
