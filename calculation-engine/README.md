# 个人风险计量引擎 - 计算引擎

## 项目结构

```
calculation-engine/
├── src/
│   ├── var/                    # VaR计算模块
│   │   ├── historical.py       # 历史模拟法
│   │   ├── parametric.py       # 参数法
│   │   ├── monte_carlo.py      # 蒙特卡洛模拟
│   │   └── cornish_fisher.py   # Cornish-Fisher展开
│   │
│   ├── stress/                 # 压力测试模块
│   │   ├── scenarios.py        # 压力情景定义
│   │   ├── historical.py       # 历史情景分析
│   │   ├── hypothetical.py     # 假设情景分析
│   │   └── sensitivity.py      # 敏感性分析
│   │
│   ├── risk/                   # 风险分析模块
│   │   ├── decomposition.py    # 风险分解
│   │   ├── attribution.py      # 风险归因
│   │   ├── optimization.py     # 组合优化
│   │   └── metrics.py          # 风险指标计算
│   │
│   ├── models/                 # 数据模型
│   │   ├── portfolio.py        # 投资组合模型
│   │   ├── holding.py          # 持仓模型
│   │   └── market_data.py      # 市场数据模型
│   │
│   ├── utils/                  # 工具函数
│   │   ├── statistics.py       # 统计工具
│   │   ├── matrix.py           # 矩阵运算
│   │   ├── date.py             # 日期处理
│   │   └── validation.py       # 数据验证
│   │
│   ├── api/                    # API接口
│   │   ├── server.py           # FastAPI服务
│   │   ├── routes/             # 路由定义
│   │   └── middleware/         # 中间件
│   │
│   ├── core/                   # 核心引擎
│   │   ├── engine.py           # 计算引擎主类
│   │   ├── cache.py            # 缓存管理
│   │   └── config.py           # 配置管理
│   │
│   └── main.py                 # 入口文件
│
├── tests/                      # 测试目录
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── notebooks/                  # Jupyter笔记本
│   ├── var_analysis.ipynb
│   ├── stress_test.ipynb
│   └── risk_optimization.ipynb
│
├── requirements.txt            # 依赖管理
├── Dockerfile                  # Docker构建
├── docker-compose.yml          # 服务编排
└── README.md                   # 项目说明
```

## 技术栈

- **语言**: Python 3.11+
- **Web框架**: FastAPI
- **计算库**: NumPy, SciPy, Pandas
- **统计库**: statsmodels, scipy.stats
- **优化库**: scipy.optimize, cvxpy
- **机器学习**: scikit-learn (可选)
- **缓存**: Redis
- **API文档**: FastAPI自动生成的OpenAPI/Swagger

## 核心算法

### 1. VaR计算方法

#### 历史模拟法
```python
def historical_var(returns, confidence_level=0.95):
    """
    基于历史数据的VaR计算
    
    Args:
        returns: 历史收益率序列
        confidence_level: 置信水平
    
    Returns:
        VaR值（负数表示损失）
    """
    return np.percentile(returns, (1 - confidence_level) * 100)
```

#### 参数法（方差-协方差法）
```python
def parametric_var(mean, std, confidence_level=0.95):
    """
    基于正态分布假设的VaR计算
    
    Args:
        mean: 收益率均值
        std: 收益率标准差
        confidence_level: 置信水平
    
    Returns:
        VaR值
    """
    z_score = stats.norm.ppf(1 - confidence_level)
    return -(mean + z_score * std)
```

#### 蒙特卡洛模拟
```python
def monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=10000):
    """
    基于蒙特卡洛模拟的VaR计算
    
    Args:
        returns: 历史收益率矩阵
        weights: 资产权重
        confidence_level: 置信水平
        n_simulations: 模拟次数
    
    Returns:
        VaR值
    """
    # 计算均值和协方差矩阵
    mean = np.mean(returns, axis=0)
    cov = np.cov(returns.T)
    
    # 生成随机样本
    simulated_returns = np.random.multivariate_normal(mean, cov, n_simulations)
    portfolio_returns = np.dot(simulated_returns, weights)
    
    return np.percentile(portfolio_returns, (1 - confidence_level) * 100)
```

### 2. 压力测试方法

#### 历史情景分析
```python
def historical_scenario_analysis(portfolio, scenario_date):
    """
    基于历史重大事件的压力测试
    
    Args:
        portfolio: 投资组合对象
        scenario_date: 历史情景日期（如2008-09-15）
    
    Returns:
        压力测试结果
    """
    # 获取历史市场数据
    market_data = get_historical_data(scenario_date)
    
    # 计算组合在压力情景下的损失
    losses = calculate_portfolio_loss(portfolio, market_data)
    
    return {
        'scenario_date': scenario_date,
        'portfolio_value': portfolio.current_value,
        'stressed_value': portfolio.current_value + losses,
        'loss_amount': losses,
        'loss_percentage': losses / portfolio.current_value
    }
```

### 3. 风险分解方法

#### 风险贡献分解
```python
def risk_contribution_decomposition(weights, covariance_matrix):
    """
    分解各资产对组合风险的贡献
    
    Args:
        weights: 资产权重向量
        covariance_matrix: 收益率协方差矩阵
    
    Returns:
        各资产的风险贡献
    """
    # 组合波动率
    portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(covariance_matrix, weights)))
    
    # 边际贡献
    marginal_contrib = np.dot(covariance_matrix, weights) / portfolio_vol
    
    # 成分贡献
    component_contrib = weights * marginal_contrib
    
    # 贡献百分比
    contrib_percentage = component_contrib / portfolio_vol
    
    return {
        'marginal_contribution': marginal_contrib,
        'component_contribution': component_contrib,
        'contribution_percentage': contrib_percentage
    }
```

## API接口

### 计算服务

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="风险计量引擎 - 计算服务")

class VaRRequest(BaseModel):
    portfolio_id: str
    confidence_level: float = 0.95
    time_horizon: int = 1
    method: str = "historical"

@app.post("/api/v1/calculate/var")
async def calculate_var(request: VaRRequest):
    """
    计算投资组合VaR
    """
    result = await var_engine.calculate(request)
    return result

@app.post("/api/v1/calculate/stress")
async def calculate_stress_test(portfolio_id: str, scenario: str):
    """
    执行压力测试
    """
    result = await stress_engine.test(portfolio_id, scenario)
    return result

@app.post("/api/v1/calculate/risk-metrics")
async def calculate_risk_metrics(portfolio_id: str):
    """
    计算风险指标
    """
    result = await risk_engine.calculate_metrics(portfolio_id)
    return result
```

## 开发环境

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 运行服务
uvicorn src.main:app --reload --port 8000

# 运行测试
pytest

# 查看API文档
# http://localhost:8000/docs
```

## 依赖列表

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
numpy==1.26.2
scipy==1.11.4
pandas==2.1.3
statsmodels==0.14.0
scikit-learn==1.3.2
cvxpy==1.4.1
redis==5.0.1
httpx==0.25.2
python-dotenv==1.0.0
pytest==7.4.3
pytest-asyncio==0.21.1
```

## Docker部署

```bash
# 构建镜像
docker build -t risk-engine-calculation .

# 运行容器
docker run -d -p 8000:8000 --env-file .env risk-engine-calculation
```

## 性能优化

1. **缓存策略**: 使用Redis缓存计算结果
2. **异步计算**: 长时间计算使用后台任务
3. **矩阵优化**: 使用NumPy向量化运算
4. **并行计算**: 多进程处理大规模数据
5. **增量更新**: 仅计算变化部分

## 监控指标

- 计算响应时间
- 计算准确率
- 内存使用率
- CPU使用率
- 缓存命中率
- 队列长度
