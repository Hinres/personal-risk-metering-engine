const app = getApp();

const getApiBase = () => {
  return app?.globalData?.apiBaseUrl || 'https://api.riskengine.com/v1';
};

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const baseUrl = getApiBase();
    wx.request({
      ...options,
      url: options.url.startsWith('http') ? options.url : `${baseUrl}${options.url}`,
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
          wx.removeStorageSync('token');
          wx.removeStorageSync('user');
          app?.handleTokenExpired?.();
          wx.navigateTo({ url: '/pages/user/login/login' });
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
};

module.exports = {
  get: (url, params) => request({ url, method: 'GET', data: params }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  del: (url) => request({ url, method: 'DELETE' }),
  download: (url, filePath) => new Promise((resolve, reject) => {
    wx.downloadFile({
      url: url.startsWith('http') ? url : `${getApiBase()}${url}`,
      filePath,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res);
        } else {
          reject(new Error(`Download failed (${res.statusCode})`));
        }
      },
      fail: reject
    });
  })
};
