# 个人风险计量引擎 (PRME)

> 面向个人投资者的投资组合风险计量与管理系统，支持 VaR、压力测试、风险监控、报告生成等核心能力。

---

## 项目简介

PRME（Personal Risk Metering Engine）是一套为个人投资者设计的**风险计量引擎**，帮助用户：

- 创建并管理投资组合与持仓
- 计算多种方法的 VaR（历史模拟法、参数法、蒙特卡洛、Cornish-Fisher）
- 执行压力测试与风险归因
- 设置风险监控规则并接收预警
- 生成风险报告

本项目采用 **monorepo** 组织，包含后端 API、Python 计算引擎、Web 管理后台、微信小程序四个子系统。

---

## 技术栈

| 子系统 | 技术 |
|--------|------|
| 后端 API | Node.js 18+ · Express · TypeScript · TypeORM |
| 数据库 | SQLite（开发/测试默认）· PostgreSQL（生产可选） |
| 缓存 | 内存 L1 缓存 + SQLite L2 缓存表（Redis 已移除） |
| 计算引擎 | Python 3.11+ · NumPy · SciPy · Pandas · 内嵌/独立双模式 |
| Web 后台 | React 18 · TypeScript · Vite · Ant Design · Zustand |
| 小程序 | 微信小程序原生框架 |
| 认证 | JWT + Passport（无状态 + 黑名单） |

---

## 项目结构

```
personal-risk-metering-engine/
├── backend/                 # 后端 API 服务（Node.js + TypeScript）
│   ├── src/                 # 源码
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
└── README.md                # 本文件
```

---

## 快速开始

### 1. 克隆并安装后端

```bash
git clone https://github.com/Hinres/personal-risk-metering-engine.git
cd personal-risk-metering-engine/backend
cp .env.example .env        # 修改其中的密钥和敏感配置
npm install
npm run init-db             # 初始化 SQLite 数据库
npm run seed                # 灌入种子数据（可选）
npm run dev                 # 启动开发服务，默认 http://localhost:3000
```

### 2. 启动计算引擎（可选，默认后端内嵌）

```bash
cd ../calculation-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.main          # 默认 http://localhost:8000
```

### 3. 启动 Web 后台

```bash
cd ../frontend/web-admin
cp .env.example .env        # 配置后端 API 地址
npm install
npm run dev                 # 默认 http://localhost:5173
```

### 4. 打开微信小程序

使用微信开发者工具打开 `frontend/wechat-miniprogram`，并在 `project.config.json` 中配置小程序 appid。

---

## 环境变量

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

---

## 测试

```bash
# 后端测试
cd backend
npm run test

# 计算引擎测试
cd ../calculation-engine
pytest
```

---

## Docker 部署（生产）

```bash
cd personal-risk-metering-engine
# 配置好 .env 后
docker-compose up -d
```

生产默认使用 PostgreSQL + 独立计算引擎。开发环境可直接使用 SQLite + 内嵌计算引擎。

---

## 文档索引

| 文档 | 路径 |
|------|------|
| 架构设计 | `architecture/PRME-System-Architecture-v1.3-*.md` |
| 详细设计 | `architecture/PRME-Detailed-Design-v1.2-*.md` |
| 需求文档 | `product-requirements/` |
| 测试报告 | `qa-consolidated/` |

---

## 安全提示

- 生产环境务必修改 `JWT_SECRET` 和 `WECHAT_APPSECRET`。
- 不要将真实数据库、日志、上传文件提交到仓库。
- 发现安全漏洞请通过 issue 联系维护者。

---

## 许可证

[待定，请补充 LICENSE 文件]
