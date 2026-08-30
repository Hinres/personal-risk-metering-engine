const app = getApp();
const api = require('../../../utils/api');
const { formatDate } = require('../../../utils/format');
const { requireLogin, refreshUserState } = require('../../../utils/auth');

Page({
  data: {
    user: null,
    unreadCount: 0,
    useWechatAvatar: false,
    tempAvatarUrl: '',
    editingNickName: '',
    loading: true,
    saving: false,
    error: false
  },

  onShow() {
    if (!requireLogin()) return;
    this.loadUser();
  },

  async loadUser() {
    this.setData({ loading: true, error: false });
    try {
      await refreshUserState();
      const user = app.globalData.userInfo;
      if (!user) throw new Error('用户信息未加载');
      const prefs = user.preferences || {};
      const formatted = this.formatUser(user);
      this.setData({
        user: formatted,
        unreadCount: app.globalData.unreadCount || 0,
        useWechatAvatar: !!prefs.use_wechat_avatar,
        tempAvatarUrl: '',
        editingNickName: formatted.wechatNickName || '',
        loading: false,
        error: false
      });
    } catch (e) {
      console.error('Load profile failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  formatUser(user) {
    const prefs = user.preferences || {};
    const sub = user.subscription || {};
    const wechat = user.wechat_info || {};
    return {
      ...user,
      created_at_fmt: formatDate(user.created_at),
      displayName: wechat.nickName || user.nickname || user.username || '用户',
      avatarUrl: user.avatar_url || wechat.avatarUrl || '',
      subscriptionPlan: sub.plan || 'free',
      subscriptionLabel: sub.plan || '免费版',
      wechatNickName: wechat.nickName || ''
    };
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/user/settings/settings' });
  },

  goToHelp() {
    wx.navigateTo({ url: '/pages/user/help/help' });
  },

  goToAlerts() {
    wx.navigateTo({ url: '/pages/monitor/alerts/alerts' });
  },

  goToSubscription() {
    wx.navigateTo({ url: '/pages/user/subscription/subscription' });
  },

  goToTools() {
    wx.navigateTo({ url: '/pages/tool/calculator/calculator' });
  },

  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    this.setData({ tempAvatarUrl: tempUrl });
  },

  onNicknameInput(e) {
    this.setData({ editingNickName: e.detail.value || '' });
  },

  async saveWechatInfo() {
    const { user, tempAvatarUrl, editingNickName, useWechatAvatar } = this.data;
    if (!tempAvatarUrl && !editingNickName.trim()) {
      wx.showToast({ title: '请先选择头像或填写昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      let avatarUrl = tempAvatarUrl || user.avatarUrl || '';

      // 优先尝试上传头像到后端，若后端未提供上传接口则回退为临时文件路径
      if (tempAvatarUrl) {
        try {
          const uploadRes = await this.uploadAvatar(tempAvatarUrl);
          if (uploadRes && uploadRes.url) {
            avatarUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn('Avatar upload failed, fallback to temp path', uploadErr);
        }
      }

      await api.put('/users/wechat', {
        nick_name: editingNickName.trim() || user.wechatNickName || user.displayName,
        avatar_url: avatarUrl
      });

      await api.put('/users/preferences', { use_wechat_avatar: true });
      await refreshUserState();

      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({
        useWechatAvatar: true,
        tempAvatarUrl: '',
        user: this.formatUser(app.globalData.userInfo)
      });
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      const base = app.globalData.apiBaseUrl;
      wx.uploadFile({
        url: `${base}/users/avatar`,
        filePath,
        name: 'avatar',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          try {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            resolve(data.data || data);
          } catch (e) {
            reject(e);
          }
        },
        fail: reject
      });
    });
  },

  async onToggleWechatAvatar(e) {
    const enabled = e.detail.value;
    try {
      await api.put('/users/preferences', { use_wechat_avatar: enabled });
      await refreshUserState();
      this.setData({
        useWechatAvatar: enabled,
        user: this.formatUser(app.globalData.userInfo)
      });
      wx.showToast({ title: '设置已保存', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
      this.setData({ useWechatAvatar: !enabled });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('user');
          app.globalData.token = null;
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.riskAcked = false;
          app.globalData.consents = {};
          app.globalData.unreadCount = 0;
          wx.showToast({ title: '已退出', icon: 'success' });
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/user/login/login' });
          }, 800);
        }
      }
    });
  },

  onRetry() {
    this.loadUser();
  }
});
