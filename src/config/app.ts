/**
 * [PRME-INFRA-005] 系统配置
 * 文件: app.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
export const APP_CONFIG = {
  port: parseInt(process.env.PORT || '3000'),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  nodeEnv: process.env.NODE_ENV || 'development',
  // calcEngineUrl: process.env.CALC_ENGINE_URL || 'http://localhost:8000', // 已内嵌计算引擎，不再需要
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
  },
};
