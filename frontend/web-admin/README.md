# 个人风险计量引擎 - Web管理后台

## 项目结构

```
web-admin/
├── public/                     # 静态资源
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── assets/                 # 资源文件
│   │   ├── images/
│   │   └── styles/
│   │
│   ├── components/             # 公共组件
│   │   ├── Layout/             # 布局组件
│   │   ├── Sidebar/            # 侧边栏
│   │   ├── Header/             # 顶部导航
│   │   ├── RiskChart/          # 风险图表
│   │   ├── DataTable/          # 数据表格
│   │   └── Modal/              # 弹窗组件
│   │
│   ├── pages/                  # 页面
│   │   ├── Login/              # 登录页
│   │   ├── Dashboard/          # 仪表盘
│   │   ├── Users/              # 用户管理
│   │   ├── Portfolios/         # 组合管理
│   │   ├── Holdings/           # 持仓管理
│   │   ├── VaR/                # VaR计算
│   │   ├── StressTests/        # 压力测试
│   │   ├── Monitoring/         # 监控中心
│   │   ├── Reports/            # 报告管理
│   │   ├── Subscriptions/      # 订阅管理
│   │   ├── Orders/             # 订单管理
│   │   ├── System/             # 系统设置
│   │   └── Logs/               # 操作日志
│   │
│   ├── hooks/                  # 自定义Hooks
│   ├── services/               # API服务
│   ├── store/                  # 状态管理
│   ├── utils/                  # 工具函数
│   ├── types/                  # TypeScript类型
│   ├── App.tsx                 # 应用入口
│   └── main.tsx                # 主入口
│
├── .env                        # 环境变量
├── .env.production             # 生产环境变量
├── vite.config.ts              # Vite配置
├── tsconfig.json               # TypeScript配置
├── tailwind.config.js          # Tailwind配置
├── package.json                # 依赖管理
└── README.md                   # 项目说明
```

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI库**: Ant Design 5.x
- **状态管理**: Zustand
- **路由**: React Router v6
- **图表**: ECharts / Recharts
- **样式**: Tailwind CSS + Less
- **HTTP**: Axios
- **表单**: React Hook Form

## 开发环境

```bash
# 安装依赖
npm install

# 开发运行
npm run dev

# 构建
npm run build

# 预览
npm run preview
```

## 功能特性

1. **仪表盘**: 系统概览、数据统计、实时监控
2. **用户管理**: 用户列表、详情、权限管理
3. **组合管理**: 投资组合CRUD操作
4. **风险计算**: VaR计算、压力测试执行
5. **监控中心**: 实时监控、预警管理
6. **报告管理**: 报告生成、查看、下载
7. **订阅管理**: 套餐配置、订单管理
8. **系统设置**: 参数配置、日志查看
