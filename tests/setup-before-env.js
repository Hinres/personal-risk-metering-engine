// Jest 前置: 修复 Node.js 20+ 中 path-scurry 对 fs.realpathSync.native 的依赖
const fs = require('fs');
console.log('[setup-before-env] fs.realpathSync exists:', !!fs.realpathSync);
console.log('[setup-before-env] fs.realpathSync.native exists:', !!(fs.realpathSync && fs.realpathSync.native));
if (!fs.native) {
  Object.defineProperty(fs, 'native', { value: fs, writable: false });
}
if (!fs.realpathSync) {
  fs.realpathSync = function(p) { return p; };
}
if (!fs.realpathSync.native) {
  fs.realpathSync.native = fs.realpathSync;
}
console.log('[setup-before-env] fs.realpathSync.native set:', !!fs.realpathSync.native);

// Set test WeChat credentials for auth.service tests
process.env.WECHAT_APPID = process.env.WECHAT_APPID || 'test_appid';
process.env.WECHAT_APPSECRET = process.env.WECHAT_APPSECRET || 'test_secret';
console.log('[setup-before-env] WECHAT_APPID set:', !!process.env.WECHAT_APPID);

// Set JWT_SECRET before any module loads jwt.ts
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
console.log('[setup-before-env] JWT_SECRET set:', !!process.env.JWT_SECRET);
