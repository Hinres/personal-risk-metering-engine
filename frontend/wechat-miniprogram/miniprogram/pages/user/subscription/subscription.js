const app = getApp();
const api = require('../../../utils/api');
const { formatDate } = require('../../../utils/format');
const { SUBSCRIPTION_TIERS } = require('../../../utils/constants');
const { requireLogin } = require('../../../utils/auth');

const BENEFITS = {
  free: ['组合数量：3 个', 'VaR 计算：历史模拟法', '基础风险报告', '邮件通知'],
  premium: ['组合数量：10 个', 'VaR 计算：全部 4 种方法', '高级风险报告', '压力测试', '订阅消息预警'],
  professional: ['组合数量：无限制', 'VaR 计算：全部 4 种方法', '专业报告导出(PDF/Excel)', '自定义监控规则', 'API 访问', '优先客服']
};

const COMPARE_ROWS = [
  { name: '组合数量', free: '3 个', premium: '10 个', professional: '无限制' },
  { name: 'VaR 方法', free: '1 种', premium: '4 种', professional: '4 种' },
  { name: '压力测试', free: '-', premium: '✓', professional: '✓' },
  { name: '报告导出', free: '-', premium: 'PDF', professional: 'PDF/Excel' },
  { name: '自定义监控', free: '-', premium: '-', professional: '✓' },
  { name: '订阅消息预警', free: '-', premium: '✓', professional: '✓' }
];

Page({
  data: {
    subscription: null,
    tierLabel: '-',
    expiresAt: '--',
    benefits: [],
    allTiers: SUBSCRIPTION_TIERS,
    compareRows: COMPARE_ROWS,
    loading: true,
    error: false
  },

  onShow() {
    requireLogin();
    this.loadSubscription();
  },

  async loadSubscription() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/users/profile');
      const user = res.data || res;
      const sub = user.subscription || {};
      const tier = sub.plan || 'free';
      const tierItem = SUBSCRIPTION_TIERS.find(t => t.key === tier) || SUBSCRIPTION_TIERS[0];
      this.setData({
        subscription: sub,
        tierLabel: tierItem.label,
        expiresAt: formatDate(sub.expires_at),
        benefits: BENEFITS[tier] || BENEFITS.free,
        loading: false,
        error: false
      });
    } catch (e) {
      console.error('Load subscription failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  onRenew() {
    wx.showToast({ title: '续费功能将在后续版本开放', icon: 'none' });
  },

  onRetry() {
    this.loadSubscription();
  }
});
