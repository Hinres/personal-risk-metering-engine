import numpy as np
from typing import Dict, List, Tuple, Optional


def risk_parity_optimization(
    returns: np.ndarray,
    cov_matrix: np.ndarray,
    symbols: List[str],
    target_volatility: Optional[float] = None,
) -> Dict:
    """
    风险平价优化：使每个资产对组合风险的贡献相等
    
    Args:
        returns: 历史收益率矩阵 (T x N)
        cov_matrix: 协方差矩阵 (N x N)
        symbols: 资产代码列表
        target_volatility: 目标波动率 (可选)
    """
    n = len(symbols)
    if n == 0:
        return {"error": "No assets provided"}
    
    # 风险平价权重计算 (简化版)
    # 更精确的做法是迭代优化，这里使用近似解
    # w_i ∝ 1 / σ_i
    diag_vols = np.sqrt(np.diag(cov_matrix))
    # 处理零波动率
    diag_vols = np.where(diag_vols > 0, diag_vols, np.inf)
    inv_vols = 1.0 / diag_vols
    inv_vols = np.where(np.isfinite(inv_vols), inv_vols, 0)
    
    # 处理全零/全无穷情况：返回均匀权重
    total_inv = inv_vols.sum()
    if total_inv > 0 and np.isfinite(total_inv):
        weights = inv_vols / total_inv
    else:
        weights = np.ones(n) / n
    
    # 计算组合统计
    portfolio_return = np.dot(weights, np.mean(returns, axis=0))
    portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
    
    # 风险贡献
    marginal_risk = np.dot(cov_matrix, weights)
    risk_contrib = weights * marginal_risk / portfolio_volatility if portfolio_volatility > 0 else np.zeros(n)
    
    result = {
        "method": "risk_parity",
        "weights": {symbols[i]: round(weights[i], 4) for i in range(n)},
        "expected_return": round(portfolio_return, 6),
        "expected_volatility": round(portfolio_volatility, 6),
        "risk_contributions": {symbols[i]: round(risk_contrib[i], 4) for i in range(n)},
        "sharpe_ratio": round(portfolio_return / portfolio_volatility, 4) if portfolio_volatility > 0 else 0,
    }
    
    if target_volatility and portfolio_volatility > 0:
        scale = target_volatility / portfolio_volatility
        scaled_weights = weights * scale
        result["scaled_weights"] = {symbols[i]: round(scaled_weights[i], 4) for i in range(n)}
        result["scaled_volatility"] = target_volatility
    
    return result


def minimum_variance_optimization(
    returns: np.ndarray,
    cov_matrix: np.ndarray,
    symbols: List[str],
    allow_short: bool = False,
) -> Dict:
    """
    最小方差优化：在预期收益约束下最小化组合方差
    
    简化版：使用协方差矩阵的逆来近似
    """
    n = len(symbols)
    if n == 0:
        return {"error": "No assets provided"}
    
    try:
        # 添加正则化防止奇异矩阵，并做充分性检查
        reg_cov = cov_matrix + np.eye(n) * 1e-6
        
        # 检查条件数，若条件数过大则增加正则化强度
        cond = np.linalg.cond(reg_cov)
        if cond > 1e12:
            reg_cov = cov_matrix + np.eye(n) * 1e-4
        elif cond > 1e8:
            reg_cov = cov_matrix + np.eye(n) * 1e-5
        
        inv_cov = np.linalg.inv(reg_cov)
        
        # 最小方差组合权重: w = inv(Σ) * 1 / (1' * inv(Σ) * 1)
        ones = np.ones(n)
        weights = np.dot(inv_cov, ones) / np.dot(ones, np.dot(inv_cov, ones))
        
        if not allow_short:
            weights = np.maximum(weights, 0)
            weights = weights / weights.sum() if weights.sum() > 0 else np.ones(n) / n
        
        portfolio_return = np.dot(weights, np.mean(returns, axis=0))
        portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        
        return {
            "method": "minimum_variance",
            "weights": {symbols[i]: round(weights[i], 4) for i in range(n)},
            "expected_return": round(portfolio_return, 6),
            "expected_volatility": round(portfolio_volatility, 6),
            "sharpe_ratio": round(portfolio_return / portfolio_volatility, 4) if portfolio_volatility > 0 else 0,
        }
    except np.linalg.LinAlgError:
        return {"error": "Covariance matrix is singular, cannot compute minimum variance portfolio"}


def maximum_sharpe_optimization(
    returns: np.ndarray,
    cov_matrix: np.ndarray,
    symbols: List[str],
    risk_free_rate: float = 0.03,
    allow_short: bool = False,
) -> Dict:
    """
    最大夏普比率优化：最大化 (预期收益 - 无风险利率) / 波动率
    
    简化版：使用解析解近似
    """
    n = len(symbols)
    if n == 0:
        return {"error": "No assets provided"}
    
    try:
        mean_returns = np.mean(returns, axis=0)
        excess_returns = mean_returns - risk_free_rate
        
        # 添加正则化
        reg_cov = cov_matrix + np.eye(n) * 1e-6
        inv_cov = np.linalg.inv(reg_cov)
        
        # 最大夏普组合权重: w = inv(Σ) * (μ - rf) / (1' * inv(Σ) * (μ - rf))
        weights = np.dot(inv_cov, excess_returns)
        weights = weights / weights.sum() if weights.sum() != 0 else np.ones(n) / n
        
        if not allow_short:
            weights = np.maximum(weights, 0)
            weights = weights / weights.sum() if weights.sum() > 0 else np.ones(n) / n
        
        portfolio_return = np.dot(weights, mean_returns)
        portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        sharpe = (portfolio_return - risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0
        
        return {
            "method": "maximum_sharpe",
            "weights": {symbols[i]: round(weights[i], 4) for i in range(n)},
            "expected_return": round(portfolio_return, 6),
            "expected_volatility": round(portfolio_volatility, 6),
            "risk_free_rate": risk_free_rate,
            "sharpe_ratio": round(sharpe, 4),
        }
    except np.linalg.LinAlgError:
        return {"error": "Covariance matrix is singular"}


def mean_variance_optimization(
    returns: np.ndarray,
    cov_matrix: np.ndarray,
    symbols: List[str],
    target_return: Optional[float] = None,
    target_volatility: Optional[float] = None,
    risk_free_rate: float = 0.03,
) -> Dict:
    """
    均值-方差优化 (Markowitz): 在预期收益和方差之间寻找最优权衡
    
    提供有效前沿上的组合
    """
    n = len(symbols)
    if n == 0:
        return {"error": "No assets provided"}
    
    mean_returns = np.mean(returns, axis=0)
    
    # 生成有效前沿上的多个组合
    target_returns = np.linspace(mean_returns.min(), mean_returns.max(), 20)
    efficient_frontier = []
    
    for tr in target_returns:
        try:
            # 简化：使用二次规划近似
            reg_cov = cov_matrix + np.eye(n) * 1e-6
            inv_cov = np.linalg.inv(reg_cov)
            
            # 使用拉格朗日乘数法求解
            # 简化为：w = inv(Σ) * (μ - λ * 1) 
            ones = np.ones(n)
            a = np.dot(ones, np.dot(inv_cov, ones))
            b = np.dot(ones, np.dot(inv_cov, mean_returns))
            c = np.dot(mean_returns, np.dot(inv_cov, mean_returns))
            
            # 解 λ
            lambda_val = (b * tr - c) / (b**2 - a * c) if (b**2 - a * c) != 0 else 0
            
            weights = np.dot(inv_cov, (mean_returns - lambda_val * ones))
            weights = np.maximum(weights, 0)
            weights = weights / weights.sum() if weights.sum() > 0 else np.ones(n) / n
            
            vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            ret = np.dot(weights, mean_returns)
            
            efficient_frontier.append({
                "target_return": round(tr, 6),
                "achieved_return": round(ret, 6),
                "volatility": round(vol, 6),
                "sharpe": round((ret - risk_free_rate) / vol, 4) if vol > 0 else 0,
            })
        except Exception:
            continue
    
    # 找到有效前沿上夏普最高的点
    best = max(efficient_frontier, key=lambda x: x["sharpe"]) if efficient_frontier else None
    
    return {
        "method": "mean_variance",
        "efficient_frontier": efficient_frontier,
        "optimal_portfolio": best,
        "risk_free_rate": risk_free_rate,
    }
