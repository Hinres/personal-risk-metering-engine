/**
 * PRME 编号补充脚本（修复版）- 跳过权限错误
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

const REMAINING_FILES = [
  // PRME-INFRA-004 测试
  { file: '../tests/unit/marketData.service.test.ts', prme: 'PRME-INFRA-004', isTest: true },
  // PRME-INFRA-005
  { file: 'services/system.service.ts', prme: 'PRME-INFRA-005' },
  { file: 'controllers/system.controller.ts', prme: 'PRME-INFRA-005' },
  { file: 'models/SystemConfig.ts', prme: 'PRME-INFRA-005' },
  { file: 'models/SubscriptionPlan.ts', prme: 'PRME-INFRA-005' },
  { file: 'models/Order.ts', prme: 'PRME-INFRA-005' },
  { file: 'config/app.ts', prme: 'PRME-INFRA-005' },
  // PRME-INFRA-006
  { file: 'app.ts', prme: 'PRME-INFRA-006' },
  { file: 'types/index.ts', prme: 'PRME-INFRA-006' },
  { file: 'types/node-cron.d.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/date.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/encryption.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/jsonb.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/logger.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/pagination.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/response.ts', prme: 'PRME-INFRA-006' },
  { file: 'utils/validators.ts', prme: 'PRME-INFRA-006' },
  { file: 'middleware/error.middleware.ts', prme: 'PRME-INFRA-006' },
  { file: 'middleware/logger.middleware.ts', prme: 'PRME-INFRA-006' },
  { file: 'middleware/validator.middleware.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/index.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/swagger.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/auth.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/help.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/holding.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/monitor.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/notification.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/optimization.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/portfolio.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/report.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/stress.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/system.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/tool.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/user.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/valuation.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'routes/var.routes.ts', prme: 'PRME-INFRA-006' },
  { file: 'database/migrations/001-initial-schema.ts', prme: 'PRME-INFRA-006' },
  { file: 'database/seeds/development.seed.ts', prme: 'PRME-INFRA-006' },
  // PRME-INFRA-006 测试
  { file: '../tests/integration/sqlite.migration.test.ts', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/integration/trigger-application-layer.test.ts', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/integration/graceful-shutdown.test.ts', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/unit/jobs.test.ts', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/unit/typescript-strict.test.ts', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/performance/k6-performance-test.js', prme: 'PRME-INFRA-006', isTest: true },
  { file: '../tests/performance/artillery-load-test.yml', prme: 'PRME-INFRA-006', isTest: true },
];

const PRME_NAMES = {
  'PRME-INFRA-004': '市场数据',
  'PRME-INFRA-005': '系统配置',
  'PRME-INFRA-006': '基础设施',
};

function annotate(item) {
  const baseDir = item.isTest ? path.join(__dirname, '../') : SRC_DIR;
  const fullPath = path.join(baseDir, item.file);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  不存在: ${item.file}`);
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('[PRME-') || content.includes(item.prme)) {
      console.log(`  ⏭️  跳过(已存在): ${item.file}`);
      return true;
    }

    const name = PRME_NAMES[item.prme] || '基础设施';
    const baseName = path.basename(item.file);
    const prefix = item.isTest ? `${name} - 测试文件` : name;
    const scope = item.isTest ? '功能验证' : '功能实现';
    const header = `/**\n * [${item.prme}] ${prefix}\n * 文件: ${baseName}\n * ${item.isTest ? '测试范围' : '需求描述'}: ${name}${scope}\n * 最后更新: 2026-06-09\n */\n`;
    fs.writeFileSync(fullPath, header + content, 'utf8');
    console.log(`  ✅ 已添加: ${item.file} [${item.prme}]`);
    return true;
  } catch (e) {
    if (e.code === 'EACCES') {
      console.warn(`  ❌ 无权限: ${item.file} (需手动处理)`);
    } else {
      console.warn(`  ❌ 错误: ${item.file} - ${e.message}`);
    }
    return false;
  }
}

console.log('=== PRME 编号补充（修复版）===\n');
let ok = 0, fail = 0;
for (const item of REMAINING_FILES) {
  if (annotate(item)) ok++; else fail++;
}
console.log(`\n=== 结果: ${ok} 成功, ${fail} 失败 ===`);
