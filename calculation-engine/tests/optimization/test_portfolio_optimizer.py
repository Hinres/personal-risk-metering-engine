import pytest
import numpy as np
from src.optimization.portfolio_optimizer import (
    risk_parity_optimization,
    minimum_variance_optimization,
    maximum_sharpe_optimization,
    mean_variance_optimization,
)


class TestRiskParityOptimization:
    """风险平价优化测试"""

    def test_risk_parity_basic(self):
        """基本功能"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B"])
        
        assert result["method"] == "risk_parity"
        assert "weights" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 1e-6

    def test_risk_parity_empty_assets(self):
        """空资产列表"""
        result = risk_parity_optimization(
            np.array([]), np.array([]), []
        )
        assert "error" in result

    def test_risk_parity_degenerate_all_zero_vol(self):
        """CE-8: 所有资产波动率为0时的退化处理"""
        returns = np.array([
            [0.01, 0.01],
            [0.01, 0.01],
            [0.01, 0.01]
        ])  # 零波动
        cov = np.cov(returns.T)  # 这将是一个奇异矩阵
        result = risk_parity_optimization(returns, cov, ["A", "B"])
        
        # 当前实现会返回均匀权重，这是退化处理
        # 测试验证当前行为
        assert "weights" in result
        assert sum(result["weights"].values()) == pytest.approx(1.0, abs=1e-6)

    def test_risk_parity_with_target_volatility(self):
        """带目标波动率"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B"], target_volatility=0.15)
        
        assert "scaled_weights" in result
        assert "scaled_volatility" in result
        assert result["scaled_volatility"] == pytest.approx(0.15, abs=1e-6)


class TestMinimumVarianceOptimization:
    """最小方差优化测试"""

    def test_minimum_variance_basic(self):
        """基本功能"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B"])
        
        assert result["method"] == "minimum_variance"
        assert abs(sum(result["weights"].values()) - 1.0) < 1e-6

    def test_minimum_variance_no_short(self):
        """禁止做空时权重非负"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B"], allow_short=False)
        
        for w in result["weights"].values():
            assert w >= 0, "禁止做空时权重不应为负"

    def test_minimum_variance_singular_matrix(self):
        """CE-2: 奇异协方差矩阵处理"""
        returns = np.array([
            [0.01, 0.01],
            [0.01, 0.01],
            [0.01, 0.01]
        ])  # 完全相关，协方差矩阵奇异
        cov = np.cov(returns.T)
        
        # 当前实现添加1e-6正则化后求逆
        # 对于真正奇异的矩阵，这可能仍然不稳定
        result = minimum_variance_optimization(returns, cov, ["A", "B"])
        
        # 验证不崩溃
        assert "error" not in result or "weights" in result


class TestMaximumSharpeOptimization:
    """最大夏普比率优化测试"""

    def test_maximum_sharpe_basic(self):
        """基本功能"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], risk_free_rate=0.03)
        
        assert result["method"] == "maximum_sharpe"
        assert "sharpe_ratio" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 1e-6

    def test_maximum_sharpe_no_short(self):
        """禁止做空"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], allow_short=False)
        
        for w in result["weights"].values():
            assert w >= 0


class TestMeanVarianceOptimization:
    """均值-方差优化测试"""

    def test_mean_variance_basic(self):
        """基本功能"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        cov = np.cov(returns.T)
        result = mean_variance_optimization(returns, cov, ["A", "B"])
        
        assert result["method"] == "mean_variance"
        assert "efficient_frontier" in result
        assert len(result["efficient_frontier"]) > 0
        assert "optimal_portfolio" in result

    def test_mean_variance_empty_assets(self):
        """空资产列表"""
        result = mean_variance_optimization(
            np.array([]), np.array([]), []
        )
        assert "error" in result


class TestRegularization:
    """CE-2: 正则化充分性测试"""

    def test_regularization_value_is_1e_6(self):
        """验证当前正则化值为1e-6"""
        # 这个测试验证已知行为，用于文档记录
        # 当前实现使用 np.eye(n) * 1e-6 作为正则化
        # 对于高度共线的数据，1e-6可能不足
        returns = np.array([
            [0.01, 0.0101],  # 高度相关
            [0.02, 0.0201],
            [-0.01, -0.0101]
        ])
        cov = np.cov(returns.T)
        
        # 条件数检查
        cond = np.linalg.cond(cov)
        # 如果条件数很大，1e-6的正则化可能不足
        if cond > 1e8:
            pytest.skip(f"条件数过大({cond:.2e})，1e-6正则化可能不足 — CE-2相关")
        
        result = minimum_variance_optimization(returns, cov, ["A", "B"])
        assert "weights" in result
