// components/error-state/error-state.js
Component({
  properties: {
    title: { type: String, value: '加载失败' },
    desc: { type: String, value: '网络开小差了，请稍后重试' },
    retryText: { type: String, value: '重新加载' },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry');
    }
  }
});
