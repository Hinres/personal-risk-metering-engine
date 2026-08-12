from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np
from src.optimization.portfolio_optimizer import (
    risk_parity_optimization,
    minimum_variance_optimization,
    maximum_sharpe_optimization,
    mean_variance_optimization,
)

router = APIRouter()


class OptimizationRequest(BaseModel):
    portfolio_id: str = Field(..., description="投资组合ID")
    method: str = Field(..., description="优化方法: risk_parity | min_variance | max_sharpe | mean_variance")
    holdings: List[dict] = Field(..., description="持仓列表，每项包含 symbol, current_price, quantity, sector")
    historical_returns: List[List[float]] = Field(..., description="历史收益率矩阵 (T x N)")
    risk_free_rate: float = Field(0.03, ge=0, le=0.50, description="无风险利率")
    target_return: Optional[float] = Field(None, description="目标收益率(仅mean_variance)")
    target_volatility: Optional[float] = Field(None, description="目标波动率(仅risk_parity)")
    allow_short: bool = Field(False, description="是否允许做空")


@router.post("/optimize")
async def optimize_portfolio(request: OptimizationRequest):
    """组合优化：风险平价/最小方差/最大夏普/均值方差"""
    n = len(request.holdings)
    if n == 0:
        raise HTTPException(status_code=400, detail="Portfolio has no holdings")

    returns = np.array(request.historical_returns)
    if returns.ndim == 1:
        returns = returns.reshape(-1, 1)

    cov_matrix = np.cov(returns.T)
    symbols = [h["symbol"] for h in request.holdings]

    method_map = {
        "risk_parity": risk_parity_optimization,
        "min_variance": minimum_variance_optimization,
        "max_sharpe": maximum_sharpe_optimization,
        "mean_variance": mean_variance_optimization,
    }

    optimizer = method_map.get(request.method)
    if not optimizer:
        raise HTTPException(status_code=400, detail=f"Unsupported optimization method: {request.method}")

    kwargs = {
        "returns": returns,
        "cov_matrix": cov_matrix,
        "symbols": symbols,
        "risk_free_rate": request.risk_free_rate,
    }

    if request.method == "risk_parity" and request.target_volatility:
        kwargs["target_volatility"] = request.target_volatility
    if request.method in ("min_variance", "max_sharpe"):
        kwargs["allow_short"] = request.allow_short
    if request.method == "mean_variance":
        if request.target_return:
            kwargs["target_return"] = request.target_return
        if request.target_volatility:
            kwargs["target_volatility"] = request.target_volatility

    result = optimizer(**kwargs)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "portfolio_id": request.portfolio_id,
        "method": request.method,
        **result,
        "current_holdings": [
            {"symbol": h["symbol"], "current_weight": h.get("weight", 1.0 / n)}
            for h in request.holdings
        ],
    }


@router.get("/methods")
async def list_optimization_methods():
    """列出支持的优化方法"""
    return {
        "methods": [
            {"id": "risk_parity", "name": "风险平价", "description": "各资产风险贡献相等"},
            {"id": "min_variance", "name": "最小方差", "description": "在约束下最小化组合波动率"},
            {"id": "max_sharpe", "name": "最大夏普比率", "description": "最大化风险调整后收益"},
            {"id": "mean_variance", "name": "均值-方差", "description": "Markowitz有效前沿优化"},
        ]
    }
