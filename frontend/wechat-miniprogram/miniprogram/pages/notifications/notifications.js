const api = require('../../utils/api');
const { formatDate } = require('../../utils/format');

Page({
  data: {
    notifications: [],
    loading: false,
    refreshing: false
  },

  onLoad() {
    this.loadNotifications();
  },

  onShow() {
    this.loadNotifications();
  },

  async loadNotifications() {
    this.setData({ loading: true });
    try {
      const res = await api.get('/notifications');
      const notifications = (res.data || []).map(n => ({
        ...n,
        created_at_fmt: formatDate(n.created_at)
      }));
      this.setData({ notifications });
    } catch (e) {
      console.error('Load notifications failed', e);
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadNotifications();
  },

  async markAsRead(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.put(`/notifications/${id}/read`, {});
      this.loadNotifications();
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
