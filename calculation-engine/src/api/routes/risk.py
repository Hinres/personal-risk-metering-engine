from fastapi import APIRouter, HTTPException
from src.risk.metrics import calculate_risk_metrics
import numpy as np
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class RiskHolding(BaseModel):
    symbol: str
    weight: Optional[float] = None

class RiskMetricsRequest(BaseModel):
    portfolio_id: str
    holdings: List[RiskHolding]
    historical_returns: List[List[float]]  # 各资产的历史收益率，每行是一个时间点

class CorrelationMatrixRequest(BaseModel):
    symbols: List[str]
    historical_returns: Optional[List[List[float]]] = None  # 可选，如果传入则使用传入数据

@router.post("/calculate/correlation-matrix")
async def calculate_correlation_matrix(request: CorrelationMatrixRequest):
    """Calculate correlation matrix for a list of assets.
    
    If historical_returns is provided, use it to calculate the matrix.
    Otherwise, return a placeholder structure with estimated correlations.
    """
    n = len(request.symbols)
    if n == 0:
        raise HTTPException(status_code=400, detail="At least one symbol is required")
    
    if request.historical_returns and len(request.historical_returns) > 0:
        returns = np.array(request.historical_returns)
        if returns.ndim == 2 and returns.shape[1] == n:
            corr_matrix = np.corrcoef(returns.T)
            return {
                "symbols": request.symbols,
                "matrix": corr_matrix.tolist(),
                "source": "calculated",
                "data_points": returns.shape[0]
            }
    
    # Fallback: estimated correlation matrix (identity + 0.3 off-diagonal)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(1.0)
            else:
                row.append(0.3)
        matrix.append(row)
    
    return {
        "symbols": request.symbols,
        "matrix": matrix,
        "source": "estimated",
        "data_points": 0
    }

@router.post("/calculate/risk-metrics")
async def calculate_portfolio_risk_metrics(request: RiskMetricsRequest):
    """Calculate risk metrics for a portfolio using real data."""
    n_assets = len(request.holdings)
    if n_assets == 0:
        raise HTTPException(status_code=400, detail="Portfolio must have at least one holding")
    
    if not request.historical_returns or len(request.historical_returns) == 0:
        raise HTTPException(status_code=400, detail="Historical returns data is required")
    
    returns = np.array(request.historical_returns)
    
    # 计算组合收益率（按权重加权）
    weights = np.array([h.weight if h.weight is not None else 1.0/n_assets for h in request.holdings])
    weights = weights / weights.sum()
    
    if returns.ndim > 1 and returns.shape[1] == n_assets:
        portfolio_returns = np.dot(returns, weights)
    elif returns.ndim == 1:
        portfolio_returns = returns
    else:
        raise HTTPException(status_code=400, detail="Historical returns shape does not match holdings count")
    
    metrics = calculate_risk_metrics(portfolio_returns)
    
    # 计算各资产的独立风险指标
    asset_metrics = {}
    if returns.ndim > 1 and returns.shape[1] == n_assets:
        for i, h in enumerate(request.holdings):
            asset_returns = returns[:, i]
            asset_metrics[h.symbol] = calculate_risk_metrics(asset_returns)
    
    return {
        "portfolio_id": request.portfolio_id,
        "metrics": metrics,
        "asset_metrics": asset_metrics,
        "holding_count": n_assets,
        "data_points": len(portfolio_returns),
    }
