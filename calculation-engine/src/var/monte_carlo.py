import numpy as np
from typing import Dict, List, Optional

def calculate_monte_carlo_var(
    returns: np.ndarray,
    weights: np.ndarray,
    confidence_level: float = 0.95,
    n_simulations: int = 10000,
    symbols: Optional[List[str]] = None,
    random_seed: Optional[int] = None
) -> Dict:
    """Calculate VaR using Monte Carlo simulation."""
    rng = np.random.default_rng(random_seed if random_seed is not None else 42)

    
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
    
    mean = np.mean(returns, axis=1) if returns.ndim > 1 else np.array([np.mean(returns)])
    
    if returns.ndim > 1:
        n_assets = returns.shape[0]
        cov = np.cov(returns)
        if cov.ndim == 0:
            cov = np.array([[float(cov)]])
        elif cov.ndim == 1:
            cov = np.array([[float(cov)]])
        simulated_returns = rng.multivariate_normal(mean, cov, n_simulations)
        portfolio_returns = np.dot(simulated_returns, weights)
    else:
        std = np.std(returns)
        simulated_returns = rng.normal(mean[0], std, n_simulations)
        portfolio_returns = simulated_returns
    
    var_value = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
    expected_return = np.mean(portfolio_returns)
    volatility = np.std(portfolio_returns)
    
    # Component contributions based on covariance
    components = []
    if returns.ndim > 1:
        for i in range(len(weights)):
            symbol = symbols[i] if symbols and i < len(symbols) else f"Asset_{i}"
            asset_simulated = simulated_returns[:, i] if i < simulated_returns.shape[1] else np.zeros(n_simulations)
            asset_var = np.percentile(asset_simulated, (1 - confidence_level) * 100)
            components.append({
                "symbol": symbol,
                "contribution": float(asset_var * weights[i]),
                "percentage": float(weights[i] * 100)
            })
    
    # Risk factor decomposition based on variance contribution
    if returns.ndim > 1 and volatility > 0 and len(weights) > 1:
        cov_matrix = np.cov(returns)
        if cov_matrix.ndim == 0:
            cov_matrix = np.array([[float(cov_matrix)]])
        elif cov_matrix.ndim == 1:
            cov_matrix = np.array([[float(cov_matrix)]])
        mvar = np.dot(cov_matrix, weights) / volatility
        contributions = weights * mvar
        risk_factors = []
        for i in range(min(len(weights), 5)):
            symbol = symbols[i] if symbols and i < len(symbols) else f"Asset_{i}"
            risk_factors.append({
                "factor": symbol,
                "exposure": float(contributions[i]),
                "contribution": float(contributions[i] / volatility * 100) if volatility > 0 else 0
            })
    else:
        risk_factors = [
            {"factor": "Market Risk", "exposure": float(volatility), "contribution": 100.0}
        ]
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(abs(var_value) * 100),
        "expected_return": float(expected_return),
        "volatility": float(volatility),
        "components": components,
        "risk_factors": risk_factors
    }