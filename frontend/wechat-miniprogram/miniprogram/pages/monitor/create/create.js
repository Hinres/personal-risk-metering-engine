const api = require('../../../utils/api');
const { MONITOR_TYPES, COMPARISONS, SEVERITY_LEVELS } = require('../../../utils/constants');

// 前端比较操作符 key → 后端符号
const COMPARISON_TO_OPERATOR = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  eq: '=',
};

// 后端符号 → 前端比较操作符 key
const OPERATOR_TO_COMPARISON = {
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  '=': 'eq',
};

// v1.3 新增监控类型：后端使用固定阈值/逻辑，前端不强制输入阈值
const SPECIALIZED_MONITOR_TYPES = ['stop_loss', 'risk_event', 'volatility_spike'];

const NOTIFICATION_METHODS = [
  { key: 'app_push', label: '应用推送' },
  { key: 'wechat', label: '微信通知' },
  { key: 'sms', label: '短信' },
  { key: 'email', label: '邮件' }
];

const buildNotificationChecked = (methods) => {
  const checked = {};
  const list = Array.isArray(methods) ? methods : [];
  NOTIFICATION_METHODS.forEach(m => {
    checked[m.key] = list.includes(m.key);
  });
  return checked;
};

Page({
  data: {
    monitorId: '',
    portfolioId: '',
    isEdit: false,
    monitorName: '',
    monitorTypeIndex: 0,
    thresholdValue: '',
    comparisonIndex: 0,
    severityIndex: 0,
    notificationMethods: [],
    notificationChecked: {},
    MONITOR_TYPES,
    COMPARISONS,
    SEVERITY_LEVELS,
    NOTIFICATION_METHODS,
    loading: false,
    submitting: false,
    error: false,
    errorMsg: ''
  },

  onLoad(options) {
    this.setData({ portfolioId: options.portfolioId || '' });
    if (options.id) {
      this.setData({ monitorId: options.id, isEdit: true });
      this.loadDetail(options.id);
    } else {
      this.setData({
        notificationChecked: buildNotificationChecked([]),
        loading: false
      });
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get(`/monitors/${id}`);
      const d = res.data || res;
      const monitorTypeIndex = MONITOR_TYPES.findIndex(t => t.key === d.monitor_type);
      const comparisonKey = OPERATOR_TO_COMPARISON[d.comparison] || d.comparison;
      const comparisonIndex = COMPARISONS.findIndex(c => c.key === comparisonKey);
      const severityIndex = SEVERITY_LEVELS.findIndex(s => s.key === d.severity);
      const methods = d.notification_methods || [];
      this.setData({
        monitorName: d.monitor_name || '',
        monitorTypeIndex: monitorTypeIndex >= 0 ? monitorTypeIndex : 0,
        thresholdValue: d.threshold_value !== undefined && d.threshold_value !== null ? String(d.threshold_value) : '',
        comparisonIndex: comparisonIndex >= 0 ? comparisonIndex : 0,
        severityIndex: severityIndex >= 0 ? severityIndex : 0,
        notificationMethods: methods,
        notificationChecked: buildNotificationChecked(methods),
        loading: false
      });
    } catch (e) {
      console.error('Load monitor detail failed', e);
      this.setData({
        loading: false,
        error: true,
        errorMsg: e.message || '加载规则详情失败'
      });
    }
  },

  onRetry() {
    this.loadDetail(this.data.monitorId);
  },

  onInputName(e) {
    this.setData({ monitorName: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ monitorTypeIndex: parseInt(e.detail.value, 10) });
  },

  onThresholdInput(e) {
    this.setData({ thresholdValue: e.detail.value });
  },

  onComparisonChange(e) {
    this.setData({ comparisonIndex: parseInt(e.detail.value, 10) });
  },

  onSeverityChange(e) {
    this.setData({ severityIndex: parseInt(e.detail.value, 10) });
  },

  onNotificationChange(e) {
    const methods = e.detail.value || [];
    this.setData({
      notificationMethods: methods,
      notificationChecked: buildNotificationChecked(methods)
    });
  },

  isSpecializedType() {
    const type = MONITOR_TYPES[this.data.monitorTypeIndex]?.key;
    return SPECIALIZED_MONITOR_TYPES.includes(type);
  },

  validate() {
    if (!this.data.monitorName.trim()) {
      return '请输入规则名称';
    }
    // v1.3 新增监控类型阈值由后端固定，前端不强制输入
    if (!this.isSpecializedType()) {
      if (!this.data.thresholdValue) {
        return '请输入阈值';
      }
      const value = parseFloat(this.data.thresholdValue);
      if (Number.isNaN(value)) {
        return '阈值必须为数字';
      }
    }
    return null;
  },

  async submit() {
    const error = this.validate();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const monitorType = MONITOR_TYPES[this.data.monitorTypeIndex].key;
    const comparisonKey = COMPARISONS[this.data.comparisonIndex].key;
    const payload = {
      monitor_name: this.data.monitorName.trim(),
      monitor_type: monitorType,
      threshold_value: this.isSpecializedType() ? 0 : parseFloat(this.data.thresholdValue),
      comparison: COMPARISON_TO_OPERATOR[comparisonKey] || comparisonKey,
      severity: SEVERITY_LEVELS[this.data.severityIndex].key,
      notification_methods: this.data.notificationMethods
    };
    if (this.data.portfolioId) {
      payload.portfolio_id = this.data.portfolioId;
    }

    this.setData({ submitting: true });
    try {
      if (this.data.isEdit) {
        await api.put(`/monitors/${this.data.monitorId}`, payload);
      } else {
        await api.post('/monitors', payload);
      }
      wx.showToast({ title: this.data.isEdit ? '保存成功' : '创建成功', icon: 'success' });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.redirectTo({ url: '/pages/monitor/rules/rules' });
        }
      }, 1000);
    } catch (e) {
      console.error('Submit monitor failed', e);
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
