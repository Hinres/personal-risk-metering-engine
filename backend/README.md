# 个人风险计量引擎 - 后端API服务

## 项目结构

```
backend/
├── src/
│   ├── config/                 # 配置文件
│   │   ├── database.ts         # 数据库配置
│   │   ├── redis.ts            # Redis配置
│   │   ├── jwt.ts              # JWT配置
│   │   └── app.ts              # 应用配置
│   │
│   ├── controllers/            # 控制器
│   │   ├── auth.controller.ts  # 认证控制器
│   │   ├── user.controller.ts  # 用户控制器
│   │   ├── portfolio.controller.ts # 组合控制器
│   │   ├── holding.controller.ts    # 持仓控制器
│   │   ├── var.controller.ts       # VaR控制器
│   │   ├── stress.controller.ts    # 压力测试控制器
│   │   ├── monitor.controller.ts   # 监控控制器
│   │   ├── report.controller.ts    # 报告控制器
│   │   └── system.controller.ts    # 系统控制器
│   │
│   ├── services/               # 业务服务
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── portfolio.service.ts
│   │   ├── holding.service.ts
│   │   ├── var.service.ts
│   │   ├── marketData.service.ts
│   │   ├── calculationEngine.service.ts
│   │   ├── monitor.service.ts
│   │   ├── report.service.ts
│   │   └── notification.service.ts
│   │
│   ├── models/                 # 数据模型
│   │   ├── user.model.ts
│   │   ├── portfolio.model.ts
│   │   ├── holding.model.ts
│   │   ├── marketData.model.ts
│   │   ├── varCalculation.model.ts
│   │   ├── stressTest.model.ts
│   │   ├── riskMonitor.model.ts
│   │   ├── alertRecord.model.ts
│   │   └── riskReport.model.ts
│   │
│   ├── middleware/             # 中间件
│   │   ├── auth.middleware.ts  # 认证中间件
│   │   ├── error.middleware.ts # 错误处理
│   │   ├── rateLimit.middleware.ts # 限流
│   │   ├── validator.middleware.ts # 参数验证
│   │   └── logger.middleware.ts    # 请求日志
│   │
│   ├── routes/                 # 路由定义
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── portfolio.routes.ts
│   │   ├── holding.routes.ts
│   │   ├── var.routes.ts
│   │   ├── stress.routes.ts
│   │   ├── monitor.routes.ts
│   │   ├── report.routes.ts
│   │   └── system.routes.ts
│   │
│   ├── utils/                  # 工具函数
│   │   ├── logger.ts           # 日志工具
│   │   ├── response.ts         # 响应封装
│   │   ├── validator.ts        # 验证工具
│   │   ├── encryption.ts       # 加密工具
│   │   └── date.ts             # 日期工具
│   │
│   ├── jobs/                   # 定时任务
│   │   ├── marketDataSync.job.ts   # 市场数据同步
│   │   ├── varCalculation.job.ts   # VaR定时计算
│   │   ├── riskMonitoring.job.ts   # 风险监控
│   │   └── reportGeneration.job.ts # 报告生成
│   │
│   ├── types/                  # TypeScript类型
│   │   ├── express.d.ts
│   │   └── index.ts
│   │
│   ├── database/               # 数据库
│   │   ├── connection.ts       # 连接池
│   │   └── migrations/         # 迁移文件
│   │
│   └── app.ts                  # 应用入口
│
├── tests/                      # 测试目录
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env                        # 环境变量
├── .env.example                # 环境变量示例
├── tsconfig.json               # TypeScript配置
├── package.json                # 依赖管理
├── Dockerfile                  # Docker构建
└── README.md                   # 项目说明
```

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js 4.x
- **语言**: TypeScript
- **数据库**: PostgreSQL 14+
- **缓存**: Redis 7+
- **ORM**: TypeORM / Prisma
- **认证**: JWT + Passport
- **验证**: Joi / Zod
- **日志**: Winston
- **测试**: Jest + Supertest

## API设计

### 认证API
- POST /api/v1/auth/register - 用户注册
- POST /api/v1/auth/login - 用户登录
- POST /api/v1/auth/logout - 用户登出
- POST /api/v1/auth/refresh - 刷新Token
- POST /api/v1/auth/wechat - 微信登录

### 用户API
- GET /api/v1/users/profile - 获取用户信息
- PUT /api/v1/users/profile - 更新用户信息
- GET /api/v1/users/preferences - 获取用户偏好
- PUT /api/v1/users/preferences - 更新用户偏好

### 投资组合API
- GET /api/v1/portfolios - 获取组合列表
- POST /api/v1/portfolios - 创建组合
- GET /api/v1/portfolios/:id - 获取组合详情
- PUT /api/v1/portfolios/:id - 更新组合
- DELETE /api/v1/portfolios/:id - 删除组合

### 持仓API
- GET /api/v1/portfolios/:id/holdings - 获取持仓列表
- POST /api/v1/portfolios/:id/holdings - 添加持仓
- PUT /api/v1/holdings/:id - 更新持仓
- DELETE /api/v1/holdings/:id - 删除持仓

### VaR计算API
- POST /api/v1/var/calculate - 计算VaR
- GET /api/v1/var/history - 获取VaR历史
- GET /api/v1/var/analysis - VaR分析结果

### 压力测试API
- POST /api/v1/stress/test - 执行压力测试
- GET /api/v1/stress/scenarios - 获取压力情景
- GET /api/v1/stress/history - 获取测试历史

### 监控API
- GET /api/v1/monitor/status - 获取监控状态
- GET /api/v1/monitor/alerts - 获取预警信息
- POST /api/v1/monitor/rules - 创建监控规则

### 报告API
- GET /api/v1/reports - 获取报告列表
- POST /api/v1/reports - 生成报告
- GET /api/v1/reports/:id - 获取报告详情
- GET /api/v1/reports/:id/download - 下载报告

## 开发环境

```bash
# 安装依赖
npm install

# 开发运行
npm run dev

# 构建
npm run build

# 测试
npm run test

# 数据库迁移
npm run migration:run
```

## 环境变量

```env
# 应用配置
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personal_risk_metering_engine
DB_USER=postgres
DB_PASSWORD=password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# 微信配置
WECHAT_APP_ID=your-app-id
WECHAT_APP_SECRET=your-app-secret

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
```
