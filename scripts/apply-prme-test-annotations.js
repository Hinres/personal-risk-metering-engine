/**
 * PRME 测试文件补充（绝对路径版）
 */
const fs = require('fs');
const path = require('path');

const TESTS_DIR = '/workspace/projects/personal-risk-metering-engine/backend/tests';

const REMAINING = [
  { file: 'unit/marketData.service.test.ts', prme: 'PRME-INFRA-004' },
  { file: 'integration/sqlite.migration.test.ts', prme: 'PRME-INFRA-006' },
  { file: 'integration/trigger-application-layer.test.ts', prme: 'PRME-INFRA-006' },
  { file: 'integration/graceful-shutdown.test.ts', prme: 'PRME-INFRA-006' },
  { file: 'unit/jobs.test.ts', prme: 'PRME-INFRA-006' },
  { file: 'unit/typescript-strict.test.ts', prme: 'PRME-INFRA-006' },
  { file: 'performance/k6-performance-test.js', prme: 'PRME-INFRA-006' },
  { file: 'performance/artillery-load-test.yml', prme: 'PRME-INFRA-006' },
];

const PRME_NAMES = {
  'PRME-INFRA-004': '市场数据',
  'PRME-INFRA-006': '基础设施',
};

function annotate(item) {
  const fullPath = path.join(TESTS_DIR, item.file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️ 不存在: ${fullPath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('[PRME-') || content.includes(item.prme)) {
      console.log(`  ⏭️ 跳过: ${item.file}`);
      return true;
    }

    const name = PRME_NAMES[item.prme] || '基础设施';
    const baseName = path.basename(item.file);
    const header = `/**\n * [${item.prme}] ${name} - 测试文件\n * 文件: ${baseName}\n * 测试范围: ${name}功能验证\n * 最后更新: 2026-06-09\n */\n`;
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

console.log('=== PRME 测试文件补充 ===\n');
let ok = 0, fail = 0;
for (const item of REMAINING) {
  if (annotate(item)) ok++; else fail++;
}
console.log(`\n=== 结果: ${ok} 成功, ${fail} 失败 ===`);
