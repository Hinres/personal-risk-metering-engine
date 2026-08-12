const app = getApp();

/**
 * 检查是否已登录，未登录跳转登录页
 */
function requireLogin() {
  if (!app.globalData.isLoggedIn && !wx.getStorageSync('token')) {
    wx.redirectTo({ url: '/pages/user/login/login' });
    return false;
  }
  return true;
}

/**
 * 检查是否已完成风险确认，未完成跳转风险确认页
 */
function requireRiskAck() {
  if (!app.globalData.riskAcked) {
    wx.redirectTo({ url: '/pages/user/risk-ack/risk-ack' });
    return false;
  }
  return true;
}

/**
 * 检查某项明示同意，未同意则跳转同意页
 * @param {string} consentType - 同意类型，如 optimization_advice
 * @param {Function} onGrant - 同意后的回调（可选）
 * @returns {boolean}
 */
function requireConsent(consentType, onGrant) {
  if (app.globalData.consents[consentType]) {
    if (typeof onGrant === 'function') onGrant();
    return true;
  }
  wx.navigateTo({
    url: `/pages/user/consent/consent?type=${consentType}`,
    events: {
      consentGranted: () => {
        app.setConsent(consentType, true);
        if (typeof onGrant === 'function') onGrant();
      }
    }
  });
  return false;
}

/**
 * 刷新用户状态
 */
async function refreshUserState() {
  return app.refreshUserState();
}

/**
 * 更新微信头像/昵称到后端
 */
async function updateWechatInfo(userInfo) {
  const api = require('./api');
  try {
    await api.put('/users/wechat', {
      nick_name: userInfo.nickName,
      avatar_url: userInfo.avatarUrl
    });
    await refreshUserState();
  } catch (e) {
    console.error('Update wechat info failed', e);
  }
}

module.exports = {
  requireLogin,
  requireRiskAck,
  requireConsent,
  refreshUserState,
  updateWechatInfo
};
