// components/empty-state/empty-state.js
Component({
  properties: {
    icon: { type: String, value: '' },
    title: { type: String, value: '暂无数据' },
    desc: { type: String, value: '' },
    buttonText: { type: String, value: '' },
    buttonUrl: { type: String, value: '' },
  },
  methods: {
    onButtonTap() {
      if (this.properties.buttonUrl) {
        const url = this.properties.buttonUrl;
        if (url.startsWith('/pages')) {
          if (url.startsWith('/pages/index') || url.includes('dashboard') || url.includes('list') || url.includes('profile') || url.includes('search')) {
            wx.switchTab({ url });
          } else {
            wx.navigateTo({ url });
          }
        } else {
          this.triggerEvent('buttonTap');
        }
      } else {
        this.triggerEvent('buttonTap');
      }
    }
  }
});
