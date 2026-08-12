/**
 * PRME 需求编号映射矩阵
 * 文件: /workspace/projects/personal-risk-metering-engine/backend/scripts/apply-prme-annotations.js
 * 用途: 自动为所有源码文件添加 PRME 需求编号注释
 * 生成日期: 2026-06-09
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const TESTS_DIR = path.join(__dirname, '../tests');

// PRME 需求 → 文件映射
const PRME_MAPPING = {
  // PRME-VAR: VaR风险计量模块
  'PRME-VAR-001': {
    name: '组合VaR计算',
    files: [
      'services/var.service.ts',
      'controllers/var.controller.ts',
      'models/VaRCalculation.ts',
      'models/VaRComponent.ts',
      'jobs/varCalculation.job.ts',
    ],
    tests: [
      'tests/unit/tool.service.test.ts',
      'tests/integration/end-to-end-journey.test.ts',
    ]
  },
  'PRME-VAR-002': {
    name: 'VaR分析和报告',
    files: [
      'services/report.service.ts',
      'controllers/report.controller.ts',
      'models/RiskReport.ts',
      'jobs/reportGeneration.job.ts',
    ],
    tests: [
      'tests/unit/report.service.test.ts',
      'tests/integration/report.export.test.ts',
    ]
  },
  'PRME-VAR-003': {
    name: '压力测试和情景分析',
    files: [
      'controllers/stress.controller.ts',
      'models/StressTest.ts',
      'models/StressScenario.ts',
    ],
    tests: []
  },

  // PRME-RM: 风险监控模块
  'PRME-RM-001': {
    name: '实时风险监控',
    files: [
      'services/monitor.service.ts',
      'controllers/monitor.controller.ts',
      'models/RiskMonitor.ts',
      'jobs/riskMonitoring.job.ts',
    ],
    tests: [
      'tests/integration/monitor.dashboard.test.ts',
    ]
  },
  'PRME-RM-002': {
    name: '风险预警系统',
    files: [
      'services/notification.service.ts',
      'controllers/notification.controller.ts',
      'models/AlertRecord.ts',
      'models/MarketRiskAlert.ts',
      'models/MarketRiskAlertTemplate.ts',
    ],
    tests: []
  },
  'PRME-RM-003': {
    name: '持仓风险管理',
    files: [
      'services/holding.service.ts',
      'controllers/holding.controller.ts',
      'models/Holding.ts',
      'models/HoldingLimit.ts',
    ],
    tests: [
      'tests/unit/portfolio.service.test.ts',
    ]
  },

  // PRME-PA: 投资组合分析模块
  'PRME-PA-001': {
    name: '组合结构分析',
    files: [
      'services/portfolio.service.ts',
      'controllers/portfolio.controller.ts',
      'models/Portfolio.ts',
      'models/PortfolioSnapshot.ts',
    ],
    tests: [
      'tests/unit/portfolio.service.test.ts',
    ]
  },
  'PRME-PA-002': {
    name: '风险收益分析',
    files: [
      'services/portfolio.service.ts',
      'controllers/portfolio.controller.ts',
      'models/PortfolioSnapshot.ts',
    ],
    tests: [
      'tests/unit/portfolio.service.test.ts',
    ]
  },
  'PRME-PA-003': {
    name: '优化建议',
    files: [
      'services/compliance.service.ts',
      'controllers/optimization.controller.ts',
      'models/OptimizationResult.ts',
    ],
    tests: [
      'tests/unit/compliance.service.test.ts',
    ]
  },

  // PRME-TS: 工具和设置模块
  'PRME-TS-001': {
    name: 'VaR计算器',
    files: [
      'services/tool.service.ts',
      'controllers/tool.controller.ts',
      'models/ToolVaRHistory.ts',
    ],
    tests: [
      'tests/unit/tool.service.test.ts',
    ]
  },
  'PRME-TS-002': {
    name: '用户设置',
    files: [
      'services/user.service.ts',
      'controllers/user.controller.ts',
      'services/auth.service.ts',
      'controllers/auth.controller.ts',
      'models/User.ts',
      'models/UserConsent.ts',
      'models/UserSession.ts',
    ],
    tests: [
      'tests/unit/auth.test.ts',
      'tests/unit/consent.service.test.ts',
    ]
  },
  'PRME-TS-003': {
    name: '帮助和教程',
    files: [
      'services/helpContent.service.ts',
      'controllers/help.controller.ts',
      'models/HelpContent.ts',
    ],
    tests: [
      'tests/unit/helpContent.service.test.ts',
    ]
  },

  // 基础设施/合规/安全 (非核心功能需求，但属于P3非功能需求)
  'PRME-INFRA-001': {
    name: '认证与授权',
    files: [
      'middleware/auth.middleware.ts',
      'middleware/riskAcknowledgment.middleware.ts',
      'middleware/rateLimit.middleware.ts',
      'config/jwt.ts',
      'models/AdminApprovalRequest.ts',
      'models/OperationLog.ts',
    ],
    tests: [
      'tests/unit/auth.test.ts',
      'tests/unit/audit.service.test.ts',
    ]
  },
  'PRME-INFRA-002': {
    name: '审计与合规',
    files: [
      'services/audit.service.ts',
      'services/consent.service.ts',
      'services/dataExport.service.ts',
      'services/compliance.service.ts',
      'models/AnonymizationLog.ts',
      'models/DataExportRequest.ts',
    ],
    tests: [
      'tests/unit/audit.service.test.ts',
      'tests/unit/consent.service.test.ts',
      'tests/unit/compliance.service.test.ts',
    ]
  },
  'PRME-INFRA-003': {
    name: '性能与缓存',
    files: [
      'services/cache.service.ts',
      'services/websocket.service.ts',
      'config/redis.ts',
      'config/database.ts',
    ],
    tests: [
      'tests/unit/cache.service.test.ts',
    ]
  },
  'PRME-INFRA-004': {
    name: '市场数据',
    files: [
      'services/marketData.service.ts',
      'models/MarketData.ts',
      'models/Stock.ts',
      'models/FinancialData.ts',
      'models/ValuationRecord.ts',
      'jobs/marketDataSync.job.ts',
    ],
    tests: [
      'tests/unit/marketData.service.test.ts',
    ]
  },
  'PRME-INFRA-005': {
    name: '系统配置',
    files: [
      'services/system.service.ts',
      'controllers/system.controller.ts',
      'models/SystemConfig.ts',
      'models/SubscriptionPlan.ts',
      'models/Order.ts',
      'config/app.ts',
    ],
    tests: []
  },
  'PRME-INFRA-006': {
    name: '基础设施',
    files: [
      'app.ts',
      'types/index.ts',
      'types/node-cron.d.ts',
      'utils/date.ts',
      'utils/encryption.ts',
      'utils/jsonb.ts',
      'utils/logger.ts',
      'utils/pagination.ts',
      'utils/response.ts',
      'utils/validators.ts',
      'middleware/error.middleware.ts',
      'middleware/logger.middleware.ts',
      'middleware/validator.middleware.ts',
      'routes/index.ts',
      'routes/swagger.routes.ts',
      'routes/auth.routes.ts',
      'routes/help.routes.ts',
      'routes/holding.routes.ts',
      'routes/monitor.routes.ts',
      'routes/notification.routes.ts',
      'routes/optimization.routes.ts',
      'routes/portfolio.routes.ts',
      'routes/report.routes.ts',
      'routes/stress.routes.ts',
      'routes/system.routes.ts',
      'routes/tool.routes.ts',
      'routes/user.routes.ts',
      'routes/valuation.routes.ts',
      'routes/var.routes.ts',
      'database/migrations/001-initial-schema.ts',
      'database/seeds/development.seed.ts',
    ],
    tests: [
      'tests/integration/sqlite.migration.test.ts',
      'tests/integration/trigger-application-layer.test.ts',
      'tests/integration/graceful-shutdown.test.ts',
      'tests/unit/jobs.test.ts',
      'tests/unit/typescript-strict.test.ts',
      'tests/performance/k6-performance-test.js',
      'tests/performance/artillery-load-test.yml',
    ]
  },
};

// 构建反向映射: 文件 -> PRME编号
const fileToPrme = {};
for (const [prmeId, mapping] of Object.entries(PRME_MAPPING)) {
  for (const f of mapping.files) {
    fileToPrme[f] = prmeId;
  }
  for (const t of mapping.tests) {
    fileToPrme[t] = prmeId;
  }
}

function generateHeaderComment(filePath, prmeId) {
  const mapping = PRME_MAPPING[prmeId];
  const baseName = path.basename(filePath);
  return `/**\n * [${prmeId}] ${mapping.name}\n * 文件: ${baseName}\n * 需求描述: ${mapping.name}功能实现\n * 最后更新: 2026-06-09\n */\n`;
}

function annotateFile(filePath, prmeId) {
  const fullPath = path.join(SRC_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  文件不存在: ${fullPath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  // 如果已有 PRME 注释，跳过
  if (content.includes('[PRME-') || content.includes(prmeId)) {
    console.log(`  ⏭️  已存在PRME注释，跳过: ${filePath}`);
    return true;
  }

  const header = generateHeaderComment(filePath, prmeId);
  const newContent = header + content;
  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`  ✅ 已添加注释: ${filePath} [${prmeId}]`);
  return true;
}

function annotateTestFile(filePath, prmeId) {
  const fullPath = path.join(__dirname, '../', filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  测试文件不存在: ${fullPath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('[PRME-') || content.includes(prmeId)) {
    console.log(`  ⏭️  已存在PRME注释，跳过: ${filePath}`);
    return true;
  }

  const mapping = PRME_MAPPING[prmeId];
  const baseName = path.basename(filePath);
  const header = `/**\n * [${prmeId}] ${mapping.name} - 测试文件\n * 文件: ${baseName}\n * 测试范围: ${mapping.name}功能验证\n * 最后更新: 2026-06-09\n */\n`;
  const newContent = header + content;
  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`  ✅ 已添加测试注释: ${filePath} [${prmeId}]`);
  return true;
}

function main() {
  console.log('=== PRME 编号体系自动打通 ===\n');
  let annotatedCount = 0;
  let skippedCount = 0;
  let missingCount = 0;

  for (const [prmeId, mapping] of Object.entries(PRME_MAPPING)) {
    console.log(`\n📦 ${prmeId}: ${mapping.name}`);
    for (const f of mapping.files) {
      const result = annotateFile(f, prmeId);
      if (result === true) annotatedCount++;
      else if (result === null) skippedCount++;
      else missingCount++;
    }
    for (const t of mapping.tests) {
      const result = annotateTestFile(t, prmeId);
      if (result === true) annotatedCount++;
      else if (result === null) skippedCount++;
      else missingCount++;
    }
  }

  console.log(`\n=== 统计 ===`);
  console.log(`已标注: ${annotatedCount}`);
  console.log(`已跳过: ${skippedCount}`);
  console.log(`不存在: ${missingCount}`);
  console.log(`\n=== 完成 ===`);

  // 生成映射矩阵报告
  generateReport();
}

function generateReport() {
  const reportPath = path.join(__dirname, '../../../../../dev-docs', 'p0-1-prme-tracing-matrix-20260609.md');
  const lines = [
    '# P0-1 PRME 需求追溯矩阵',
    '',
    '> 修复日期：2026-06-09',
    '> 对应需求：编号体系打通 [ARC-001]',
    '',
    '## 统计概览',
    '',
    '| 指标 | 数量 |',
    '|------|------|',
    `| PRME 需求项 | ${Object.keys(PRME_MAPPING).length} |`,
    `| 源码文件覆盖 | ${Object.values(PRME_MAPPING).reduce((a, m) => a + m.files.length, 0)} |`,
    `| 测试文件覆盖 | ${Object.values(PRME_MAPPING).reduce((a, m) => a + m.tests.length, 0)} |`,
    '',
    '## 需求 → 代码 → 测试 映射',
    '',
  ];

  for (const [prmeId, mapping] of Object.entries(PRME_MAPPING)) {
    lines.push(`### ${prmeId}: ${mapping.name}`);
    lines.push('');
    lines.push('**源码文件:**');
    for (const f of mapping.files) {
      const exists = fs.existsSync(path.join(SRC_DIR, f));
      lines.push(`- ${exists ? '✅' : '❌'} \`src/${f}\``);
    }
    if (mapping.tests.length > 0) {
      lines.push('');
      lines.push('**测试文件:**');
      for (const t of mapping.tests) {
        const exists = fs.existsSync(path.join(__dirname, '../', t));
        lines.push(`- ${exists ? '✅' : '❌'} \`${t}\``);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*dev 2026-06-09*');

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`\n📄 追溯矩阵报告已生成: ${reportPath}`);
}

main();
