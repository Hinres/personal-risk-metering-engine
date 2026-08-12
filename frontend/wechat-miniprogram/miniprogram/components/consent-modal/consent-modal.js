// components/consent-modal/consent-modal.js
Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '明示同意' },
    content: { type: String, value: '' },
    consentType: { type: String, value: '' },
    confirmText: { type: String, value: '同意' },
    cancelText: { type: String, value: '取消' },
  },
  methods: {
    onConfirm() {
      this.triggerEvent('confirm', { consentType: this.properties.consentType });
      this.setData({ visible: false });
    },
    onCancel() {
      this.triggerEvent('cancel', { consentType: this.properties.consentType });
      this.setData({ visible: false });
    }
  }
});
