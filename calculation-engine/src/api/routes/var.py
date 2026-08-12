from fastapi import APIRouter, HTTPException
from src.models.portfolio import VaRRequest, VaRResponse
from src.var.historical import calculate_historical_var
from src.var.parametric import calculate_parametric_var
from src.var.monte_carlo import calculate_monte_carlo_var
import numpy as np

router = APIRouter()

@router.post("/calculate/var", response_model=VaRResponse)
async def calculate_var(request: VaRRequest):
    """Calculate Value at Risk (VaR) for a portfolio."""
    n_assets = len(request.holdings)
    if n_assets == 0:
        raise HTTPException(status_code=400, detail="Portfolio must have at least one holding")
    
    weights = np.array([h.weight if h.weight is not None else 1.0/n_assets for h in request.holdings])
    weights = weights / weights.sum()
    symbols = [h.symbol for h in request.holdings]
    
    # 使用真实的历史收益率数据
    if request.historical_returns is None or len(request.historical_returns) == 0:
        raise HTTPException(status_code=400, detail="Historical returns data is required for VaR calculation")
    
    returns = np.array(request.historical_returns)
    
    if request.method == "historical":
        result = calculate_historical_var(returns, weights, request.confidence_level, symbols)
    elif request.method == "parametric":
        portfolio_returns = np.dot(weights, returns)
        result = calculate_parametric_var(
            float(np.mean(portfolio_returns)),
            float(np.std(portfolio_returns)),
            request.confidence_level,
            symbols
        )
    elif request.method == "monte_carlo":
        result = calculate_monte_carlo_var(returns, weights, request.confidence_level, symbols=symbols)
    else:
        result = calculate_historical_var(returns, weights, request.confidence_level, symbols)
    
    result["method"] = request.method
    result["confidence_level"] = request.confidence_level
    return VaRResponse(**result)