import pytest
import numpy as np
from src.optimization.portfolio_optimizer import (
    risk_parity_optimization,
    minimum_variance_optimization,
    maximum_sharpe_optimization,
    mean_variance_optimization,
)


class TestRiskParityOptimization:
    """Tests for risk parity portfolio optimization."""

    def test_risk_parity_basic(self):
        """PRME-PA-003: 风险平价优化基础功能"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B"])
        assert "error" not in result
        assert result["method"] == "risk_parity"
        assert "weights" in result
        assert "expected_return" in result
        assert "expected_volatility" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_risk_parity_weights_positive(self):
        """PRME-PA-003: 风险平价权重非负"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002, 0.0005],
            [[0.0004, 0.0001, 0.00005], [0.0001, 0.0009, 0.0001], [0.00005, 0.0001, 0.0006]],
            100,
        )
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B", "C"])
        for w in result["weights"].values():
            assert w >= 0

    def test_risk_parity_with_target_volatility(self):
        """PRME-PA-003: 带目标波动率的风险平价"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B"], target_volatility=0.02)
        assert "scaled_weights" in result
        assert "scaled_volatility" in result
        assert result["scaled_volatility"] == 0.02

    def test_empty_assets_error(self):
        """PRME-PA-003: 无资产时返回错误"""
        result = risk_parity_optimization(
            np.array([]), np.array([]), []
        )
        assert "error" in result

    def test_risk_contributions_present(self):
        """PRME-PA-003: 风险贡献数据存在"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A", "B"])
        assert "risk_contributions" in result
        assert len(result["risk_contributions"]) == 2
        assert "sharpe_ratio" in result


class TestMinimumVarianceOptimization:
    """Tests for minimum variance portfolio optimization."""

    def test_minimum_variance_basic(self):
        """PRME-PA-003: 最小方差优化基础功能"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B"])
        assert "error" not in result
        assert result["method"] == "minimum_variance"
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_minimum_variance_weights_positive_no_short(self):
        """PRME-PA-003: 不允许做空时权重非负"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B"], allow_short=False)
        for w in result["weights"].values():
            assert w >= 0

    def test_minimum_variance_lower_volatility_than_equal(self):
        """PRME-PA-003: 最小方差组合波动率应低于等权重"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002, 0.0005],
            [[0.0004, 0.0001, 0.00005], [0.0001, 0.0009, 0.0001], [0.00005, 0.0001, 0.0006]],
            100,
        )
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B", "C"])
        # Equal weight volatility
        equal_weights = np.ones(3) / 3
        equal_vol = np.sqrt(equal_weights.T @ cov @ equal_weights)
        assert result["expected_volatility"] <= equal_vol + 1e-6

    def test_empty_assets_error(self):
        """PRME-PA-003: 无资产时返回错误"""
        result = minimum_variance_optimization(np.array([]), np.array([]), [])
        assert "error" in result


class TestMaximumSharpeOptimization:
    """Tests for maximum Sharpe ratio portfolio optimization."""

    def test_maximum_sharpe_basic(self):
        """PRME-PA-003: 最大夏普比率优化基础功能"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], risk_free_rate=0.02)
        assert "error" not in result
        assert result["method"] == "maximum_sharpe"
        assert "sharpe_ratio" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_maximum_sharpe_positive_weights_no_short(self):
        """PRME-PA-003: 不允许做空时权重非负"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], allow_short=False)
        for w in result["weights"].values():
            assert w >= 0

    def test_sharpe_ratio_sensible(self):
        """PRME-PA-003: 夏普比率在合理范围"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], risk_free_rate=0.02)
        sharpe = result["sharpe_ratio"]
        assert sharpe is not None
        assert -5 < sharpe < 5  # Sensible range for daily returns

    def test_risk_free_rate_in_result(self):
        """PRME-PA-003: 结果包含无风险利率"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = maximum_sharpe_optimization(returns, cov, ["A", "B"], risk_free_rate=0.03)
        assert result["risk_free_rate"] == 0.03

    def test_empty_assets_error(self):
        """PRME-PA-003: 无资产时返回错误"""
        result = maximum_sharpe_optimization(np.array([]), np.array([]), [])
        assert "error" in result


class TestMeanVarianceOptimization:
    """Tests for mean-variance (Markowitz) optimization."""

    def test_mean_variance_basic(self):
        """PRME-PA-003: 均值-方差优化基础功能"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = mean_variance_optimization(returns, cov, ["A", "B"])
        assert "error" not in result
        assert result["method"] == "mean_variance"
        assert "efficient_frontier" in result
        assert "optimal_portfolio" in result
        assert len(result["efficient_frontier"]) > 0

    def test_efficient_frontier_monotonic(self):
        """PRME-PA-003: 有效前沿上的收益单调递增"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001, 0.002],
            [[0.0004, 0.0001, 0.00005], [0.0001, 0.0009, 0.0001], [0.00005, 0.0001, 0.0006]],
            100,
        )
        cov = np.cov(returns.T)
        result = mean_variance_optimization(returns, cov, ["A", "B", "C"])
        ef = result["efficient_frontier"]
        assert len(ef) > 0
        # Target returns should be non-decreasing
        for i in range(1, len(ef)):
            assert ef[i]["target_return"] >= ef[i - 1]["target_return"] - 1e-6

    def test_optimal_portfolio_has_max_sharpe(self):
        """PRME-PA-003: 最优组合具有最高夏普比率"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = mean_variance_optimization(returns, cov, ["A", "B"], risk_free_rate=0.02)
        optimal = result["optimal_portfolio"]
        ef = result["efficient_frontier"]
        assert optimal is not None
        max_sharpe = max(p["sharpe"] for p in ef)
        assert optimal["sharpe"] == max_sharpe

    def test_risk_free_rate_in_result(self):
        """PRME-PA-003: 结果包含无风险利率"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.003, 0.001], [[0.0004, 0.0001], [0.0001, 0.0009]], 100
        )
        cov = np.cov(returns.T)
        result = mean_variance_optimization(returns, cov, ["A", "B"], risk_free_rate=0.04)
        assert result["risk_free_rate"] == 0.04

    def test_empty_assets_error(self):
        """PRME-PA-003: 无资产时返回错误"""
        result = mean_variance_optimization(np.array([]), np.array([]), [])
        assert "error" in result


class TestOptimizationEdgeCases:
    """Edge cases for portfolio optimization."""

    def test_single_asset_risk_parity(self):
        """PRME-PA-003: 单资产风险平价应100%权重"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 100).reshape(-1, 1)
        cov = np.cov(returns.T)
        result = risk_parity_optimization(returns, cov, ["A"])
        assert result["weights"]["A"] == 1.0

    def test_single_asset_minimum_variance(self):
        """PRME-PA-003: 单资产最小方差应100%权重"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 100).reshape(-1, 1)
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A"])
        assert result["weights"]["A"] == 1.0

    def test_highly_correlated_assets(self):
        """PRME-PA-003: 高度相关资产的最小方差优化"""
        np.random.seed(42)
        base = np.random.normal(0.001, 0.02, 100)
        returns = np.column_stack([base + np.random.normal(0, 0.001, 100) for _ in range(3)])
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B", "C"])
        assert "error" not in result
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_singular_covariance_matrix(self):
        """PRME-PA-003: 奇异协方差矩阵处理"""
        # Create perfectly correlated assets (singular matrix)
        returns = np.column_stack([np.ones(100) * 0.01, np.ones(100) * 0.01])
        cov = np.cov(returns.T)
        result = minimum_variance_optimization(returns, cov, ["A", "B"])
        # Should either handle gracefully or return error
        assert "error" in result or abs(sum(result["weights"].values()) - 1.0) < 0.01
