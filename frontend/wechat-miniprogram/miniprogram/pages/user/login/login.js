const app = getApp();
const api = require('../../../utils/api');

Page({
  data: {
    username: '',
    password: '',
    loading: false
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async login() {
    const { username, password } = this.data;
    if (!username.trim() || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await api.post('/auth/login', { username, password });
      wx.setStorageSync('token', res.data.token);
      wx.setStorageSync('user', JSON.stringify(res.data.user));
      app.globalData.token = res.data.token;
      app.globalData.isLoggedIn = true;
      await app.refreshUserState();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => this.routeAfterLogin(), 800);
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  wxLogin() {
    wx.login({
      success: async (res) => {
        try {
          const result = await api.post('/auth/wechat-login', { code: res.code });
          wx.setStorageSync('token', result.data.token);
          wx.setStorageSync('user', JSON.stringify(result.data.user));
          app.globalData.token = result.data.token;
          app.globalData.isLoggedIn = true;
          await app.refreshUserState();
          wx.showToast({ title: '登录成功', icon: 'success' });
          setTimeout(() => this.routeAfterLogin(), 800);
        } catch (e) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
        }
      }
    });
  },

  routeAfterLogin() {
    if (!app.globalData.riskAcked) {
      wx.redirectTo({ url: '/pages/user/risk-ack/risk-ack' });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  }
});
