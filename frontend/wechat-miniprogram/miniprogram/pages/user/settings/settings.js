const app = getApp();
const api = require('../../../utils/api');
const { RISK_LEVELS } = require('../../../utils/constants');
const { requireLogin, refreshUserState } = require('../../../utils/auth');

Page({
  data: {
    riskLevels: RISK_LEVELS,
    riskIndex: 0,
    notificationEnabled: false,
    useWechatAvatar: false,
    loading: true,
    error: false,
    saving: false
  },

  onShow() {
    requireLogin();
    this.loadPreferences();
  },

  async loadPreferences() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/users/preferences');
      const prefs = res.data || res;
      const riskKey = prefs.risk_appetite || prefs.risk_tolerance || 'moderate';
      const riskIndex = RISK_LEVELS.findIndex(l => l.key === riskKey);
      this.setData({
        riskIndex: riskIndex >= 0 ? riskIndex : 1,
        notificationEnabled: !!prefs.notification_enabled || !!prefs.notifications,
        useWechatAvatar: !!prefs.use_wechat_avatar,
        loading: false,
        error: false
      });
    } catch (e) {
      console.error('Load preferences failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  onRiskChange(e) {
    this.setData({ riskIndex: e.detail.value });
  },

  onNotificationChange(e) {
    this.setData({ notificationEnabled: e.detail.value });
  },

  onWechatAvatarChange(e) {
    this.setData({ useWechatAvatar: e.detail.value });
  },

  async onSave() {
    const { riskLevels, riskIndex, notificationEnabled, useWechatAvatar } = this.data;
    this.setData({ saving: true });
    try {
      await api.put('/users/preferences', {
        risk_appetite: riskLevels[riskIndex].key,
        notification_enabled: notificationEnabled,
        use_wechat_avatar: useWechatAvatar
      });
      await refreshUserState();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '清除缓存会删除本地保存的登录状态，需要重新登录。是否继续？',
      confirmText: '清除',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '缓存已清除', icon: 'success' });
          app.globalData.token = null;
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.riskAcked = false;
          app.globalData.consents = {};
          app.globalData.unreadCount = 0;
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/user/login/login' });
          }, 800);
        }
      }
    });
  },

  onRetry() {
    this.loadPreferences();
  }
});
