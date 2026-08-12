# 个人风险计量引擎 - 微信小程序前端

## 项目结构

```
wechat-miniprogram/
├── miniprogram/                    # 小程序源码目录
│   ├── pages/                      # 页面目录
│   │   ├── index/                  # 首页 - 投资组合概览
│   │   ├── portfolio/              # 投资组合管理
│   │   │   ├── list/               # 组合列表
│   │   │   ├── detail/             # 组合详情
│   │   │   ├── create/             # 创建组合
│   │   │   └── edit/               # 编辑组合
│   │   ├── holdings/               # 持仓管理
│   │   │   ├── list/               # 持仓列表
│   │   │   ├── add/                # 添加持仓
│   │   │   └── edit/               # 编辑持仓
│   │   ├── var/                    # VaR风险计量
│   │   │   ├── calculate/          # VaR计算
│   │   │   ├── result/             # 计算结果
│   │   │   └── history/            # 历史记录
│   │   ├── stress/                 # 压力测试
│   │   │   ├── scenarios/          # 情景列表
│   │   │   ├── test/               # 执行测试
│   │   │   └── result/             # 测试结果
│   │   ├── monitor/                # 风险监控
│   │   │   ├── dashboard/          # 监控仪表盘
│   │   │   ├── alerts/             # 预警列表
│   │   │   └── settings/           # 监控设置
│   │   ├── reports/                # 报告中心
│   │   │   ├── list/               # 报告列表
│   │   │   ├── view/               # 查看报告
│   │   │   └── generate/           # 生成报告
│   │   ├── user/                   # 用户中心
│   │   │   ├── profile/            # 个人资料
│   │   │   ├── subscription/       # 订阅管理
│   │   │   ├── settings/           # 系统设置
│   │   │   └── help/               # 帮助中心
│   │   └── login/                  # 登录页面
│   │
│   ├── components/                 # 公共组件
│   │   ├── risk-chart/             # 风险图表组件
│   │   ├── holding-card/           # 持仓卡片
│   │   ├── alert-badge/            # 预警标识
│   │   ├── loading-spinner/        # 加载动画
│   │   ├── empty-state/            # 空状态
│   │   └── nav-bar/                # 导航栏
│   │
│   ├── utils/                      # 工具函数
│   │   ├── api.js                  # API请求封装
│   │   ├── auth.js                 # 认证工具
│   │   ├── storage.js              # 本地存储
│   │   ├── format.js               # 格式化工具
│   │   └── constants.js            # 常量定义
│   │
│   ├── services/                   # 业务服务
│   │   ├── portfolio.service.js    # 组合服务
│   │   ├── holding.service.js     # 持仓服务
│   │   ├── var.service.js         # VaR计算服务
│   │   ├── monitor.service.js     # 监控服务
│   │   ├── report.service.js      # 报告服务
│   │   └── user.service.js        # 用户服务
│   │
│   ├── app.js                      # 小程序入口
│   ├── app.json                    # 全局配置
│   ├── app.wxss                    # 全局样式
│   └── sitemap.json                # 站点地图
│
├── cloudfunctions/                 # 云函数目录
│   ├── api-proxy/                  # API代理
│   ├── auth/                       # 认证服务
│   └── notify/                     # 通知服务
│
├── project.config.json             # 项目配置文件
└── package.json                    # 依赖管理

```

## 技术栈

- **框架**: 微信小程序原生框架
- **语言**: TypeScript (可选)
- **UI**: 自定义组件 + WeUI
- **状态管理**: MobX / 原生
- **图表**: ECharts for WeChat
- **网络**: wx.request 封装

## 开发规范

1. 使用 ES6+ 语法
2. 组件化开发
3. 统一错误处理
4. 性能优化（懒加载、缓存）

## 安装依赖

```bash
npm install
```

## 开发运行

使用微信开发者工具打开项目目录

## 构建发布

```bash
npm run build
```
