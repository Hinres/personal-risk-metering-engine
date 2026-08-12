// Jest globalSetup: 在 ts-jest 编译之前修复 fs.realpathSync.native
const fs = require('fs');
if (!fs.realpathSync.native) {
  fs.realpathSync.native = fs.realpathSync;
}
module.exports = async () => {};
