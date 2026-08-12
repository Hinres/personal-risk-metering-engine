const ENV_CONFIG = {
  develop: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
  },
  trial: {
    apiBaseUrl: 'https://staging-api.riskengine.com/v1',
  },
  release: {
    apiBaseUrl: 'https://api.riskengine.com/v1',
  },
};

const getApiBaseUrl = () => {
  const env = wx.getAccountInfoSync?.()?.miniProgram?.envVersion || 'develop';
  return ENV_CONFIG[env]?.apiBaseUrl || ENV_CONFIG.release.apiBaseUrl;
};

App({
  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    riskAcked: false,
    consents: {},
    apiBaseUrl: getApiBaseUrl(),
    systemInfo: null,
    unreadCount: 0,
  },

  onLaunch(options) {
    console.log('App Launch', options);
    this.initSystemInfo();
    this.checkLoginStatus(options);
    this.initStorage();
  },

  onShow(options) {
    console.log('App Show', options);
    this.handleScene(options);
  },

  onHide() {
    console.log('App Hide');
  },

  onError(msg) {
    console.error('App Error', msg);
    wx.reportMonitor?.('app_error', 1);
  },

  // 初始化设备信息
  initSystemInfo() {
    try {
      const info = wx.getSystemInfoSync();
      this.globalData.systemInfo = info;
    } catch (e) {
      console.error('Get system info failed', e);
    }
  },

  // 解析小程序码场景
  handleScene(options) {
    if (options && options.scene) {
      console.log('Scene:', options.scene);
      // v1.3 预留：根据 scene 解析业务参数
    }
  },

  // 检查登录状态
  async checkLoginStatus(options) {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.isLoggedIn = true;
      await this.refreshUserState();
      this.routeByComplianceState(options);
    } else {
      this.routeByComplianceState(options);
    }
  },

  // 根据合规状态路由
  routeByComplianceState(options) {
    const pages = getCurrentPages?.() || [];
    const currentPage = pages.length ? pages[pages.length - 1].route : '';
    const isLoginPage = currentPage.includes('user/login');
    const isRiskAckPage = currentPage.includes('user/risk-ack');

    if (!this.globalData.isLoggedIn && !isLoginPage) {
      wx.redirectTo({ url: '/pages/user/login/login' });
      return;
    }
    if (this.globalData.isLoggedIn && !this.globalData.riskAcked && !isRiskAckPage) {
      wx.redirectTo({ url: '/pages/user/risk-ack/risk-ack' });
    }
  },

  // 刷新用户状态（登录态、风险确认态、同意态）
  async refreshUserState() {
    if (!this.globalData.token) return;
    try {
      const profile = await this.request({ url: '/users/profile', method: 'GET' });
      this.globalData.userInfo = profile.data || profile;
      wx.setStorageSync('user', JSON.stringify(this.globalData.userInfo));

      // 风险确认状态
      try {
        const riskRes = await this.request({ url: '/users/risk-acknowledgment/status', method: 'GET' });
        this.globalData.riskAcked = !!(riskRes.data?.acknowledged ?? riskRes.data?.first_risk_acknowledged ?? riskRes.acknowledged);
      } catch (e) {
        console.warn('Risk ack status fetch failed, assume false', e);
        this.globalData.riskAcked = false;
      }

      // 同意记录
      try {
        const consentRes = await this.request({ url: '/users/consents', method: 'GET' });
        const consents = consentRes.data || consentRes;
        const consentMap = {};
        (Array.isArray(consents) ? consents : []).forEach(c => {
          consentMap[c.consent_type || c.type] = c.granted || c.granted_at != null;
        });
        this.globalData.consents = consentMap;
      } catch (e) {
        console.warn('Consents fetch failed', e);
        this.globalData.consents = {};
      }

      // 未读消息数
      try {
        const unreadRes = await this.request({ url: '/notifications/unread-count', method: 'GET' });
        this.globalData.unreadCount = unreadRes.data?.unread_count || unreadRes.data?.count || 0;
      } catch (e) {
        this.globalData.unreadCount = 0;
      }
    } catch (e) {
      console.error('Refresh user state failed', e);
      if (e.message === 'Unauthorized' || (e.statusCode === 401)) {
        this.handleTokenExpired();
      }
    }
  },

  // 设置风险确认状态
  setRiskAcked(acknowledged) {
    this.globalData.riskAcked = acknowledged;
  },

  // 设置同意状态
  setConsent(consentType, granted) {
    this.globalData.consents[consentType] = granted;
  },

  // 获取用户信息
  getUserInfo() {
    this.request({
      url: '/users/profile',
      method: 'GET'
    }).then(res => {
      this.globalData.userInfo = res.data || res;
      wx.setStorageSync('user', JSON.stringify(this.globalData.userInfo));
    }).catch(err => {
      console.error('Get user info failed', err);
    });
  },

  // 处理token过期
  handleTokenExpired() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('user');
    this.globalData.token = null;
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
    this.globalData.riskAcked = false;
    this.globalData.consents = {};
    wx.showToast({
      title: '登录已过期，请重新登录',
      icon: 'none'
    });
  },

  // 初始化本地存储
  initStorage() {
    const storageKeys = ['portfolio_cache', 'holding_cache', 'var_cache'];
    storageKeys.forEach(key => {
      if (!wx.getStorageSync(key)) {
        wx.setStorageSync(key, []);
      }
    });
  },

  // 全局请求封装（统一错误码处理）
  request(options) {
    return new Promise((resolve, reject) => {
      const token = this.globalData.token || wx.getStorageSync('token');
      wx.request({
        ...options,
        url: options.url.startsWith('http') ? options.url : `${this.globalData.apiBaseUrl}${options.url}`,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...options.header
        },
        success: (res) => {
          const { statusCode, data } = res;
          if (statusCode >= 200 && statusCode < 300) {
            resolve(data);
          } else if (statusCode === 401) {
            this.handleTokenExpired();
            reject(new Error('Unauthorized'));
          } else if (statusCode === 403) {
            const msg = typeof data === 'string' ? data : (data?.message || '');
            if (msg.includes('RISK_ACK_REQUIRED') || msg.includes('RISK_ACK')) {
              wx.redirectTo({ url: '/pages/user/risk-ack/risk-ack' });
              reject(new Error('RISK_ACK_REQUIRED'));
            } else if (msg.includes('CONSENT_REQUIRED') || msg.includes('CONSENT')) {
              reject(new Error('CONSENT_REQUIRED'));
            } else {
              reject(new Error(data?.message || 'Forbidden'));
            }
          } else {
            reject(new Error(data?.message || `Request failed (${statusCode})`));
          }
        },
        fail: (err) => {
          console.error('Request failed', err);
          reject(new Error('网络请求失败，请检查网络'));
        }
      });
    });
  }
});
