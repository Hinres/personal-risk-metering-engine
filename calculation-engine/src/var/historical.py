import numpy as np
from typing import List, Dict

def calculate_historical_var(
    returns: np.ndarray,
    weights: np.ndarray,
    confidence_level: float = 0.95,
    symbols: list = None
) -> Dict:
    """Calculate VaR using historical simulation method."""
    if returns is None or len(returns) == 0:
        return {
            "var_value": 0.0,
            "var_percentage": 0.0,
            "expected_return": 0.0,
            "volatility": 0.0,
            "components": [],
            "risk_factors": [{"factor": "Market Risk", "exposure": 0.0, "contribution": 100.0}]
        }
    
    if weights is None or len(weights) == 0:
        weights = np.ones(returns.shape[1] if returns.ndim > 1 else 1)
    
    if not (0 < confidence_level < 1):
        confidence_level = 0.95
    
    # Calculate portfolio returns
    if returns.ndim == 1:
        portfolio_returns = returns
    else:
        portfolio_returns = np.dot(weights, returns)
    
    # Calculate VaR as the percentile of losses
    var_value = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
    
    # Calculate expected return and volatility
    expected_return = np.mean(portfolio_returns)
    volatility = np.std(portfolio_returns)
    
    # Component contributions
    components = []
    if returns.ndim > 1:
        for i in range(len(weights)):
            symbol = symbols[i] if symbols and i < len(symbols) else f"Asset_{i}"
            component_return = returns[:, i] if i < returns.shape[1] else np.zeros(len(returns))
            # Marginal VaR contribution
            marginal_var = np.percentile(component_return, (1 - confidence_level) * 100)
            components.append({
                "symbol": symbol,
                "contribution": float(marginal_var * weights[i]),
                "percentage": float(weights[i] * 100)
            })
    
    # Risk factor decomposition based on actual variance contribution
    total_var = volatility ** 2
    if total_var > 0 and returns.ndim > 1 and len(weights) > 1:
        cov_matrix = np.cov(returns)
        if cov_matrix.ndim == 0:
            cov_matrix = np.array([[float(cov_matrix)]])
        elif cov_matrix.ndim == 1:
            cov_matrix = np.array([[float(cov_matrix)]])
        mvar = np.dot(cov_matrix, weights) / volatility  # Marginal VaR
        contributions = weights * mvar
        factor_contributions = []
        for i in range(len(weights)):
            symbol = symbols[i] if symbols and i < len(symbols) else f"Asset_{i}"
            factor_contributions.append({
                "factor": symbol,
                "exposure": float(contributions[i]),
                "contribution": float(contributions[i] / volatility * 100) if volatility > 0 else 0
            })
        risk_factors = factor_contributions[:5]  # Top 5 contributors
    else:
        risk_factors = [
            {"factor": "Market Risk", "exposure": float(volatility), "contribution": 100.0}
        ]
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(abs(var_value) * 100) if expected_return != 0 else None,
        "expected_return": float(expected_return),
        "volatility": float(volatility),
        "components": components,
        "risk_factors": risk_factors
    }
