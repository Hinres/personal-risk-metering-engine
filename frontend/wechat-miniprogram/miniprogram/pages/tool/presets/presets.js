const api = require('../../../utils/api');
const { VAR_METHODS, CONFIDENCE_OPTIONS, HORIZON_OPTIONS } = require('../../../utils/constants');

Page({
  data: {
    presets: [],
    loading: false,
    error: false,
    errorMsg: ''
  },

  onLoad() {
    this.loadPresets();
  },

  onPullDownRefresh() {
    this.loadPresets().finally(() => wx.stopPullDownRefresh());
  },

  async loadPresets() {
    this.setData({ loading: true, error: false, errorMsg: '' });
    try {
      const res = await api.get('/tools/var-presets');
      const data = res.data || res;
      const list = (data.list || data.data || data || []).map(p => ({
        ...p,
        method_label: (VAR_METHODS.find(m => m.key === p.method) || {}).label || p.method,
        confidence_label: `${Math.round((p.confidence_level || 0) * 100)}%`,
        horizon_label: `${p.time_horizon || p.horizon || 1}天`
      }));
      this.setData({ presets: list, loading: false });
    } catch (e) {
      console.error('Load presets failed', e);
      this.setData({ loading: false, error: true, errorMsg: e.message || '加载失败' });
    }
  },

  onRetry() {
    this.loadPresets();
  },

  async deletePreset(e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除预设',
      content: `确定删除预设 "${name}" 吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.del(`/tools/var-presets/${encodeURIComponent(name)}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadPresets();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
