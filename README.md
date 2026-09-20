# Personal Risk Metering Engine (PRME)

> A portfolio risk metering and management system for individual investors, covering VaR, stress testing, risk monitoring, alerting, backtesting, and reporting.

**[English](#english) · [中文](#中文)**

---

<a id="english"></a>

## English

### Introduction

PRME (Personal Risk Metering Engine) is a **risk metering engine designed for individual investors**. It helps users:

- Create and manage investment portfolios and holdings
- Calculate VaR using multiple methods (Historical Simulation, Parametric, Monte Carlo, Extreme Value Theory)
- Run stress tests and risk attribution
- Configure multi-metric risk monitoring rules and receive alerts
- Backtest VaR models (Kupiec LR test) and generate hedging / optimization advice
- Generate risk reports (PDF / Excel)

The system is delivered as a **monorepo** with four subsystems: backend API, Python calculation engine, web admin console, and a WeChat mini-program.

### Feature Highlights

| Domain | Capabilities |
|---|---|
| Account & Security | JWT (access + refresh, revocation), rate-limited login, login history, fine-grained consent management, data export & anonymization (RPDP), full audit trail |
| Portfolio | Multi-portfolio CRUD, holdings, snapshots, CSV bulk import with row-level error expansion, HHI concentration & liquidity (days-to-liquidate) analysis |
| Risk Measurement | 4 VaR methods incl. EVT (PWM / MLE), CVaR / ES, volatility, max drawdown, two-level caching, VaR backtesting with graceful degradation |
| Monitoring & Alerts | 15-type monitor matrix (single source of truth, aliases supported), threshold + specialized monitors (stop-loss / risk-event / volatility-spike), cooldown, WebSocket push, per-metric alert wording |
| Market Data | Risk event library with idempotent holding matching, market volatility (daily 17:30 batch, percentiles), Tushare or built-in mock mode |
| Analysis & Advice | Hedging advice with disclaimer and degraded paths, 4 optimization methods, 5 valuation models, 5 report types |
| Feedback & Settings | 4-type feedback channel with rate limiting and admin reply loop, deep-merge user settings with audit logging |

See [FEATURES.md](./FEATURES.md) for the full feature description.

### Tech Stack

| Subsystem | Technologies |
|---|---|
| Backend API | Node.js 18+ · Express · TypeScript · TypeORM |
| Database | SQLite (dev/test default) · PostgreSQL (production option) |
| Cache | In-memory L1 + SQLite L2 cache tables (Redis removed) |
| Calculation Engine | Python 3.11+ · NumPy · SciPy · Pandas · embedded / standalone dual mode |
| Web Admin | React 18 · TypeScript · Vite · Ant Design · Zustand |
| Mini-Program | Native WeChat Mini-Program framework |
| Auth | JWT + Passport (stateless + blacklist) |

### Project Structure

```
personal-risk-metering-engine/
├── backend/                 # Backend API service (Node.js + TypeScript)
│   ├── src/                 # Source code (controllers / services / models / jobs / migrations)
│   ├── tests/               # Unit / integration / E2E tests
│   ├── scripts/             # Seed, init, and maintenance scripts
│   └── package.json
├── calculation-engine/      # Python risk calculation engine
│   ├── src/                 # VaR, stress testing, attribution, optimization algorithms
│   ├── tests/               # Algorithm tests
│   └── pyproject.toml
├── frontend/
│   ├── web-admin/           # Web admin console (React + Vite)
│   └── wechat-miniprogram/  # WeChat mini-program frontend
├── database/                # Database init / migration scripts
├── docker-compose.yml       # Production Docker orchestration (PostgreSQL mode)
├── .env.example             # Environment variable template
├── FEATURES.md              # Full feature description
└── README.md                # This file
```

### Quick Start

#### 1. Clone and install the backend

```bash
git clone https://github.com/Hinres/personal-risk-metering-engine.git
cd personal-risk-metering-engine/backend
cp .env.example .env        # Edit secrets and sensitive configuration
npm install
npm run init-db             # Initialize the SQLite database
npm run seed                # Load seed data (optional)
npm run dev                 # Dev server at http://localhost:3000
```

#### 2. Start the calculation engine (optional; embedded mode is the default)

```bash
cd ../calculation-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.main          # Default http://localhost:8000
```

#### 3. Start the web admin console

```bash
cd ../frontend/web-admin
cp .env.example .env        # Configure the backend API address
npm install
npm run dev                 # Default http://localhost:5173
```

#### 4. Open the WeChat mini-program

Open `frontend/wechat-miniprogram` with WeChat DevTools and configure the appid in `project.config.json`.

### Environment Variables

Copy `.env.example` to `.env` at the repo root and adjust per environment. Key variables:

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `PORT` | Backend port | `3000` |
| `DB_TYPE` | Database type | `sqlite` / `postgres` |
| `SQLITE_DB_PATH` | SQLite file path | `./data/database.sqlite` |
| `JWT_SECRET` | JWT signing secret | **Must be changed in production** |
| `WECHAT_APPID` / `WECHAT_APPSECRET` | WeChat mini-program credentials | From WeChat Official Platform |
| `TUSHARE_TOKEN` | Tushare market data token | From tushare.pro |
| `CALC_ENGINE_URL` | Standalone calculation engine URL | `http://localhost:8000` |

> ⚠️ **Never commit a real `.env` to Git.** The repo `.gitignore` already excludes `.env`, database files, logs, and build artifacts.

### Testing

```bash
# Backend tests
cd backend
npm run test                # 119 suites / 1660 cases

# Calculation engine tests
cd ../calculation-engine
pytest
```

### Docker Deployment (Production)

```bash
cd personal-risk-metering-engine
# Configure .env first
docker-compose up -d
```

Production defaults to PostgreSQL + standalone calculation engine. Development can use SQLite + embedded engine directly.

### Quality & Verification

- **Tests**: 119 Jest suites / 1660 cases passing; key numeric results (Kupiec backtest, HHI concentration) independently reconciled digit-by-digit by QA
- **Migrations**: TypeORM migrations 001–009, validated for both fresh databases and in-place upgrades
- **Security baseline**: owner checks on all resources (404 on cross-user access), single-source validation matrices, XSS output escaping, parameterized SQL
- **SIT / UAT**: v1.3.2 passed QA system integration testing (8/8 features + numeric reconciliation) and Req user acceptance testing (48/48 items, zero new defects)

### Documentation Index

| Document | Path |
|---|---|
| Full feature description | [FEATURES.md](./FEATURES.md) |
| Architecture design | `architecture/PRME-System-Architecture-v1.3-*.md` |
| Detailed design | `architecture/PRME-Detailed-Design-v1.2-*.md` |
| Requirements | `product-requirements/` |
| Test reports | `qa-consolidated/` |

### Security Notes

- Always change `JWT_SECRET` and `WECHAT_APPSECRET` in production.
- Never commit real databases, logs, or uploaded files.
- To report a security vulnerability, please open an issue to contact the maintainers.

### License

[TBD — please add a LICENSE file]

---
---

<a id="中文"></a>

## 中文

### 项目简介

PRME（Personal Risk Metering Engine）是一套为个人投资者设计的**风险计量引擎**，帮助用户：

- 创建并管理投资组合与持仓
- 计算多种方法的 VaR（历史模拟法、参数法、蒙特卡洛、极值理论 EVT）
- 执行压力测试与风险归因
- 设置多指标风险监控规则并接收预警
- VaR 回测（Kupiec LR 检验）与对冲 / 优化建议
- 生成风险报告（PDF / Excel）

本项目采用 **monorepo** 组织，包含后端 API、Python 计算引擎、Web 管理后台、微信小程序四个子系统。

### 功能亮点

| 领域 | 能力 |
|---|---|
| 账户与安全 | JWT（双令牌+吊销）、登录限流、登录历史、细粒度授权同意（Consent）、数据导出与匿名化（RPDP）、全链路审计 |
| 投资组合 | 多组合 CRUD、持仓、快照、CSV 批量导入（行级错误展开）、HHI 集中度与流动性（变现天数）分析 |
| 风险计量 | VaR 四法（含 EVT，PWM/MLE 参数估计）、CVaR/ES、波动率、最大回撤、两级缓存、VaR 回测（样本不足友好降级） |
| 监控预警 | 15 类监控矩阵（单一事实源、支持别名）、阈值型+专用型（止损/风险事件/波动率异常）、冷却期、WebSocket 推送、按指标分单位文案 |
| 行情与事件 | 风险事件库（幂等持仓匹配）、市场波动率（每交易日 17:30 日更、分位数）、Tushare/内置 mock 双模式 |
| 分析与建议 | 对冲建议（含免责声明与降级路径）、4 种优化方法、5 种估值模型、5 类报告 |
| 反馈与设置 | 四类型反馈渠道（频控+管理端回复闭环）、用户设置深合并+审计埋点 |

完整功能说明见 [FEATURES.md](./FEATURES.md)。

### 技术栈

| 子系统 | 技术 |
|--------|------|
| 后端 API | Node.js 18+ · Express · TypeScript · TypeORM |
| 数据库 | SQLite（开发/测试默认）· PostgreSQL（生产可选） |
| 缓存 | 内存 L1 缓存 + SQLite L2 缓存表（Redis 已移除） |
| 计算引擎 | Python 3.11+ · NumPy · SciPy · Pandas · 内嵌/独立双模式 |
| Web 后台 | React 18 · TypeScript · Vite · Ant Design · Zustand |
| 小程序 | 微信小程序原生框架 |
| 认证 | JWT + Passport（无状态 + 黑名单） |

### 项目结构

```
personal-risk-metering-engine/
├── backend/                 # 后端 API 服务（Node.js + TypeScript）
│   ├── src/                 # 源码（controllers / services / models / jobs / migrations）
│   ├── tests/               # 单元/集成/E2E 测试
│   ├── scripts/             # 种子、初始化、迁移脚本
│   └── package.json         # 后端依赖
├── calculation-engine/      # Python 风险计算引擎
│   ├── src/                 # VaR、压力测试、归因、优化等算法
│   ├── tests/               # 算法测试
│   └── pyproject.toml       # Python 依赖
├── frontend/
│   ├── web-admin/           # Web 管理后台（React + Vite）
│   └── wechat-miniprogram/  # 微信小程序前端
├── database/                # 数据库初始化/迁移脚本
├── docker-compose.yml       # 生产 Docker 编排（PostgreSQL 模式）
├── .env.example             # 环境变量模板
├── FEATURES.md              # 完整功能特性说明
└── README.md                # 本文件
```

### 快速开始

#### 1. 克隆并安装后端

```bash
git clone https://github.com/Hinres/personal-risk-metering-engine.git
cd personal-risk-metering-engine/backend
cp .env.example .env        # 修改其中的密钥和敏感配置
npm install
npm run init-db             # 初始化 SQLite 数据库
npm run seed                # 灌入种子数据（可选）
npm run dev                 # 启动开发服务，默认 http://localhost:3000
```

#### 2. 启动计算引擎（可选，默认后端内嵌）

```bash
cd ../calculation-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.main          # 默认 http://localhost:8000
```

#### 3. 启动 Web 后台

```bash
cd ../frontend/web-admin
cp .env.example .env        # 配置后端 API 地址
npm install
npm run dev                 # 默认 http://localhost:5173
```

#### 4. 打开微信小程序

使用微信开发者工具打开 `frontend/wechat-miniprogram`，并在 `project.config.json` 中配置小程序 appid。

### 环境变量

复制根目录 `.env.example` 到 `.env` 并按环境修改。关键变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `NODE_ENV` | 运行环境 | `development` / `production` |
| `PORT` | 后端端口 | `3000` |
| `DB_TYPE` | 数据库类型 | `sqlite` / `postgres` |
| `SQLITE_DB_PATH` | SQLite 文件路径 | `./data/database.sqlite` |
| `JWT_SECRET` | JWT 签名密钥 | **生产环境必须修改** |
| `WECHAT_APPID` / `WECHAT_APPSECRET` | 微信小程序凭证 | 从微信公众平台获取 |
| `TUSHARE_TOKEN` | Tushare 市场数据 token | 从 tushare.pro 获取 |
| `CALC_ENGINE_URL` | 独立计算引擎地址 | `http://localhost:8000` |

> ⚠️ **不要把真实 `.env` 提交到 Git**。仓库 `.gitignore` 已排除 `.env`、数据库文件、日志和构建产物。

### 测试

```bash
# 后端测试
cd backend
npm run test                # 119 套件 / 1660 用例

# 计算引擎测试
cd ../calculation-engine
pytest
```

### Docker 部署（生产）

```bash
cd personal-risk-metering-engine
# 配置好 .env 后
docker-compose up -d
```

生产默认使用 PostgreSQL + 独立计算引擎。开发环境可直接使用 SQLite + 内嵌计算引擎。

### 质量与验证

- **测试**：119 个 Jest 套件 / 1660 个用例全量通过；关键数值（Kupiec 回测、HHI 集中度）经 QA 独立手工复算逐位对账
- **数据库迁移**：TypeORM 迁移 001–009 全量管理，全新建库与存量升级路径均验证
- **安全基线**：全接口属主校验（越权 404）、校验矩阵单一事实源、XSS 输出转义、SQL 参数化
- **SIT / UAT**：v1.3.2 经 QA 系统集成测试（功能 8/8 + 数值对账）与 Req 用户验收测试（专项 48/48、0 新增缺陷）双重复核通过

### 文档索引

| 文档 | 路径 |
|------|------|
| 完整功能说明 | [FEATURES.md](./FEATURES.md) |
| 架构设计 | `architecture/PRME-System-Architecture-v1.3-*.md` |
| 详细设计 | `architecture/PRME-Detailed-Design-v1.2-*.md` |
| 需求文档 | `product-requirements/` |
| 测试报告 | `qa-consolidated/` |

### 安全提示

- 生产环境务必修改 `JWT_SECRET` 和 `WECHAT_APPSECRET`。
- 不要将真实数据库、日志、上传文件提交到仓库。
- 发现安全漏洞请通过 issue 联系维护者。

### 许可证

[待定，请补充 LICENSE 文件]

---

*Last updated: 2026-09-20 · v1.3.2 (SIT/UAT passed)*
