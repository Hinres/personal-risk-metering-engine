import numpy as np
from scipy import stats
from typing import Dict, Optional, List

def calculate_parametric_var(
    mean_return: float,
    std_dev: float,
    confidence_level: float = 0.95,
    symbols: Optional[List[str]] = None
) -> Dict:
    """Calculate VaR using parametric (variance-covariance) method.
    
    Args:
        mean_return: Mean return in decimal form (e.g., 0.001 for 0.1%)
        std_dev: Standard deviation in decimal form
        confidence_level: Confidence level (e.g., 0.95 for 95%)
        symbols: Optional list of asset symbols for component breakdown
    """
    if std_dev is None or std_dev < 0:
        std_dev = 0.0
    
    if not (0 < confidence_level < 1):
        confidence_level = 0.95
    
    z_score = stats.norm.ppf(1 - confidence_level)
    var_value = mean_return + z_score * std_dev
    
    # var_percentage: convert decimal VaR to percentage
    # e.g., var_value=0.05 -> 5.0%
    var_percentage = abs(var_value) * 100
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(var_percentage),
        "expected_return": float(mean_return),
        "volatility": float(std_dev),
        "components": [],
        "risk_factors": [
            {"factor": "Market Risk", "exposure": float(std_dev), "contribution": 100.0}
        ]
    }
