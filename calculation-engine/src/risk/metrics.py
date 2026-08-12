import numpy as np
from typing import List, Dict

def calculate_risk_metrics(returns: np.ndarray) -> Dict:
    """Calculate comprehensive risk metrics."""
    std = np.std(returns)
    mean = np.mean(returns)
    
    # 夏普比率：零波动时根据均值返回 inf / -inf / 0
    if std != 0:
        sharpe_ratio = float(mean / std * np.sqrt(252))
    elif mean > 0:
        sharpe_ratio = float('inf')
    elif mean < 0:
        sharpe_ratio = float('-inf')
    else:
        sharpe_ratio = 0
    
    metrics = {
        "volatility": float(std * np.sqrt(252)),  # Annualized
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown": float(calculate_max_drawdown(returns)),
        "sortino_ratio": float(calculate_sortino_ratio(returns)),
        "calmar_ratio": float(calculate_calmar_ratio(returns)),
        "skewness": float(np.mean((returns - mean)**3) / (std**3)) if std != 0 else 0,
        "kurtosis": float(np.mean((returns - mean)**4) / (std**4)) if std != 0 else 0,
    }
    return metrics

def calculate_max_drawdown(returns: np.ndarray) -> float:
    """Calculate maximum drawdown."""
    cumulative = np.cumprod(1 + returns)
    peak = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - peak) / peak
    return np.min(drawdown)

def calculate_sortino_ratio(returns: np.ndarray, risk_free_rate: float = 0.02) -> float:
    """Calculate Sortino ratio."""
    downside_returns = returns[returns < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0
    if downside_std == 0:
        return 0
    return (np.mean(returns) - risk_free_rate / 252) / downside_std * np.sqrt(252)

def calculate_calmar_ratio(returns: np.ndarray) -> float:
    """Calculate Calmar ratio."""
    max_dd = calculate_max_drawdown(returns)
    if max_dd == 0:
        return 0
    return np.mean(returns) * 252 / abs(max_dd)
