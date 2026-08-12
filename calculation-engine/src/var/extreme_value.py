import numpy as np
from scipy import stats
from typing import Dict, Optional, List

def calculate_extreme_value_var(
    returns: np.ndarray,
    confidence_level: float = 0.95,
    time_horizon: int = 1,
    symbols: Optional[List[str]] = None
) -> Dict:
    """Calculate VaR using Extreme Value Theory (EVT) — Peaks Over Threshold (POT) with GPD.
    
    Args:
        returns: Array of historical returns in decimal form (e.g., 0.01 for 1%)
        confidence_level: Confidence level (e.g., 0.95 for 95%)
        time_horizon: Time horizon in days
        symbols: Optional list of asset symbols for component breakdown
    
    Returns:
        Dictionary containing VaR value, percentage, and risk details
    """
    if returns is None or len(returns) == 0:
        return {
            "var_value": 0.0,
            "var_percentage": 0.0,
            "expected_return": 0.0,
            "volatility": 0.0,
            "components": [],
            "risk_factors": []
        }
    
    returns = np.asarray(returns, dtype=np.float64)
    returns = returns[~np.isnan(returns)]
    
    if len(returns) < 30:
        # Fallback to parametric if insufficient data
        mean_return = float(np.mean(returns))
        std_dev = float(np.std(returns, ddof=1))
        z_score = stats.norm.ppf(1 - confidence_level)
        var_value = mean_return + z_score * std_dev
        return {
            "var_value": float(var_value),
            "var_percentage": abs(var_value) * 100,
            "expected_return": mean_return,
            "volatility": std_dev,
            "components": [],
            "risk_factors": [
                {"factor": "Market Risk (EVT fallback)", "exposure": std_dev, "contribution": 100.0}
            ]
        }
    
    # Threshold: 95th percentile (POT — Peaks Over Threshold)
    threshold = np.percentile(returns, 95)
    excesses = returns[returns > threshold] - threshold
    
    if len(excesses) < 5:
        # Fallback to parametric if too few exceedances
        mean_return = float(np.mean(returns))
        std_dev = float(np.std(returns, ddof=1))
        z_score = stats.norm.ppf(1 - confidence_level)
        var_value = mean_return + z_score * std_dev
        return {
            "var_value": float(var_value),
            "var_percentage": abs(var_value) * 100,
            "expected_return": mean_return,
            "volatility": std_dev,
            "components": [],
            "risk_factors": [
                {"factor": "Market Risk (EVT fallback)", "exposure": std_dev, "contribution": 100.0}
            ]
        }
    
    # Fit Generalized Pareto Distribution (GPD) to excesses
    try:
        shape, loc, scale = stats.genpareto.fit(excesses, floc=0)
    except Exception:
        # Fallback: use method of moments
        mean_excess = np.mean(excesses)
        var_excess = np.var(excesses, ddof=1)
        if var_excess > 0 and mean_excess > 0:
            shape = mean_excess * mean_excess / var_excess / 2
            scale = mean_excess * (1 + shape)
        else:
            shape = 0.1
            scale = mean_excess
        loc = 0.0
    
    # GPD VaR formula:
    # VaR_p = u + (σ/ξ) * [ ( (N/n) * (1-p) )^(-ξ) - 1 ]
    # where u = threshold, σ = scale, ξ = shape, N = total observations, n = exceedances
    n_total = len(returns)
    n_exceed = len(excesses)
    p_tail = 1 - confidence_level
    
    if abs(shape) < 1e-6:
        # ξ ≈ 0: exponential tail
        var_tail = scale * np.log((n_total / n_exceed) * p_tail)
    else:
        var_tail = (scale / shape) * (
            np.power((n_total / n_exceed) * p_tail, -shape) - 1
        )
    
    var_value = threshold + var_tail
    
    # Scale by time horizon (square root rule for tail risk)
    var_value = var_value * np.sqrt(time_horizon)
    
    mean_return = float(np.mean(returns))
    std_dev = float(np.std(returns, ddof=1))
    
    return {
        "var_value": float(var_value),
        "var_percentage": abs(var_value) * 100,
        "expected_return": mean_return,
        "volatility": std_dev,
        "components": [],
        "risk_factors": [
            {"factor": "Tail Risk (EVT/GPD)", "exposure": float(var_tail), "contribution": 80.0},
            {"factor": "Market Risk", "exposure": std_dev, "contribution": 20.0}
        ],
        "evt_parameters": {
            "threshold": float(threshold),
            "shape": float(shape),
            "scale": float(scale),
            "exceedances": int(n_exceed),
            "threshold_percentile": 95.0
        }
    }
