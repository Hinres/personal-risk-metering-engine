import pytest
import numpy as np
from src.risk.metrics import (
    calculate_risk_metrics,
    calculate_max_drawdown,
    calculate_sortino_ratio,
    calculate_calmar_ratio,
)


class TestRiskMetrics:
    """Tests for comprehensive risk metrics calculation."""

    def test_risk_metrics_basic(self):
        """PRME-PA-002: 风险指标基础计算"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 252)
        result = calculate_risk_metrics(returns)
        expected_keys = {
            "volatility",
            "sharpe_ratio",
            "max_drawdown",
            "sortino_ratio",
            "calmar_ratio",
            "skewness",
            "kurtosis",
        }
        assert set(result.keys()) == expected_keys

    def test_volatility_annualized(self):
        """PRME-PA-002: 波动率年化正确 (× sqrt(252))"""
        returns = np.ones(252) * 0.01
        result = calculate_risk_metrics(returns)
        # For constant returns, std = 0, so annualized volatility = 0
        assert result["volatility"] == 0.0

        np.random.seed(42)
        returns = np.random.normal(0, 0.01, 252)
        result = calculate_risk_metrics(returns)
        daily_std = np.std(returns)
        expected_annualized = daily_std * np.sqrt(252)
        assert result["volatility"] == pytest.approx(expected_annualized, abs=1e-6)

    def test_sharpe_ratio_calculation(self):
        """PRME-PA-002: 夏普比率计算正确"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 252)
        result = calculate_risk_metrics(returns)
        daily_mean = np.mean(returns)
        daily_std = np.std(returns)
        expected_sharpe = (daily_mean / daily_std) * np.sqrt(252)
        assert result["sharpe_ratio"] == pytest.approx(expected_sharpe, abs=1e-6)

    def test_sharpe_ratio_zero_std(self):
        """PRME-PA-002: 零标准差时夏普比率为0"""
        returns = np.ones(252) * 0.01
        result = calculate_risk_metrics(returns)
        assert result["sharpe_ratio"] == 0.0

    def test_max_drawdown_present(self):
        """PRME-PA-002: 最大回撤存在且为负数"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 252)
        result = calculate_risk_metrics(returns)
        assert result["max_drawdown"] <= 0

    def test_sortino_ratio_present(self):
        """PRME-PA-002: 索提诺比率存在"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 252)
        result = calculate_risk_metrics(returns)
        assert result["sortino_ratio"] is not None

    def test_calmar_ratio_present(self):
        """PRME-PA-002: 卡尔玛比率存在"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 252)
        result = calculate_risk_metrics(returns)
        assert result["calmar_ratio"] is not None

    def test_skewness_calculation(self):
        """PRME-PA-002: 偏度计算"""
        # Symmetric distribution should have skewness close to 0
        np.random.seed(42)
        returns = np.random.normal(0, 0.02, 10000)
        result = calculate_risk_metrics(returns)
        assert abs(result["skewness"]) < 0.5

    def test_kurtosis_calculation(self):
        """PRME-PA-002: 峰度计算"""
        # Normal distribution has kurtosis ≈ 3 (excess kurtosis ≈ 0)
        # The implementation calculates raw kurtosis
        np.random.seed(42)
        returns = np.random.normal(0, 0.02, 10000)
        result = calculate_risk_metrics(returns)
        # Raw kurtosis of normal distribution should be close to 3
        assert result["kurtosis"] > 2.5
        assert result["kurtosis"] < 4.0

    def test_positive_returns_metrics(self):
        """PRME-PA-002: 全正收益时风险指标"""
        returns = np.ones(252) * 0.01
        result = calculate_risk_metrics(returns)
        assert result["volatility"] == 0.0
        assert result["max_drawdown"] == 0.0
        assert result["sharpe_ratio"] == 0.0
        assert result["sortino_ratio"] == 0.0  # No downside returns
        assert result["calmar_ratio"] == 0.0  # No drawdown
        assert result["skewness"] == 0.0

    def test_negative_returns_metrics(self):
        """PRME-PA-002: 全负收益时风险指标"""
        returns = np.ones(252) * (-0.01)
        result = calculate_risk_metrics(returns)
        assert result["volatility"] == 0.0
        assert result["max_drawdown"] < 0
        assert result["sharpe_ratio"] == 0.0
        assert result["sortino_ratio"] != 0.0
        assert result["calmar_ratio"] != 0.0
        assert result["skewness"] == 0.0


class TestMaxDrawdown:
    """Tests for maximum drawdown calculation."""

    def test_simple_drawdown(self):
        """PRME-PA-002: 简单回撤计算"""
        returns = np.array([0.1, -0.05, -0.05, 0.1])
        result = calculate_max_drawdown(returns)
        # Cumulative: [1.1, 1.045, 0.99275, 1.092]
        # Peak: [1.1, 1.1, 1.1, 1.1]
        # Drawdown: [0, -0.05, -0.097, 0]
        # Actually: cumulative = [1.1, 1.045, 0.99275, 1.092]
        # peak = [1.1, 1.1, 1.1, 1.1]
        # drawdown = [0, -0.05, -0.097, 0]
        # max_drawdown = -0.097
        assert result < 0

    def test_no_drawdown(self):
        """PRME-PA-002: 无回撤时返回0"""
        returns = np.array([0.01, 0.01, 0.01, 0.01])
        result = calculate_max_drawdown(returns)
        assert result == 0.0

    def test_monotonically_increasing(self):
        """PRME-PA-002: 单调递增收益无回撤"""
        returns = np.array([0.1, 0.2, 0.15, 0.05])
        result = calculate_max_drawdown(returns)
        assert result == 0.0

    def test_large_drawdown(self):
        """PRME-PA-002: 大回撤计算"""
        returns = np.array([0.0, -0.5, 0.0, 0.0])
        result = calculate_max_drawdown(returns)
        assert result == -0.5

    def test_multiple_drawdowns(self):
        """PRME-PA-002: 多次回撤取最大"""
        returns = np.array([0.1, -0.1, 0.1, -0.2, 0.1])
        # Cumulative: [1.1, 0.99, 1.089, 0.8712, 0.9583]
        # Peak: [1.1, 1.1, 1.1, 1.1, 1.1]
        # Drawdown: [0, -0.1, -0.01, -0.208, -0.13]
        # Actually peak after 0.1 is 1.1, then 1.089
        # Let me recalculate: cumprod(1+returns) = [1.1, 0.99, 1.089, 0.8712, 0.9583]
        # max_peak = [1.1, 1.1, 1.1, 1.1, 1.1]
        # drawdown = [0, -0.1, -0.01, -0.208, -0.13]
        # max = -0.208
        result = calculate_max_drawdown(returns)
        assert result <= -0.2


class TestSortinoRatio:
    """Tests for Sortino ratio calculation."""

    def test_sortino_basic(self):
        """PRME-PA-002: 索提诺比率基础计算"""
        returns = np.array([0.01, -0.01, 0.02, -0.005, 0.015])
        result = calculate_sortino_ratio(returns, risk_free_rate=0.02)
        assert result is not None

    def test_no_downside_returns(self):
        """PRME-PA-002: 无下行收益时索提诺比率为0"""
        returns = np.array([0.01, 0.01, 0.01, 0.01, 0.01])
        result = calculate_sortino_ratio(returns)
        assert result == 0.0

    def test_all_downside_returns(self):
        """PRME-PA-002: 全下行收益时索提诺比率计算"""
        returns = np.array([-0.01, -0.02, -0.005, -0.01, -0.015])
        result = calculate_sortino_ratio(returns)
        assert result is not None
        assert result < 0  # Negative returns should give negative Sortino

    def test_risk_free_rate_effect(self):
        """PRME-PA-002: 无风险利率对索提诺比率的影响"""
        returns = np.array([0.01, -0.01, 0.02, -0.005, 0.015])
        result_low_rf = calculate_sortino_ratio(returns, risk_free_rate=0.01)
        result_high_rf = calculate_sortino_ratio(returns, risk_free_rate=0.05)
        # Higher risk-free rate should give lower Sortino
        assert result_high_rf < result_low_rf


class TestCalmarRatio:
    """Tests for Calmar ratio calculation."""

    def test_calmar_basic(self):
        """PRME-PA-002: 卡尔玛比率基础计算"""
        returns = np.array([0.01, -0.01, 0.02, -0.005, 0.015])
        result = calculate_calmar_ratio(returns)
        assert result is not None

    def test_no_drawdown(self):
        """PRME-PA-002: 无回撤时卡尔玛比率为0"""
        returns = np.array([0.01, 0.01, 0.01, 0.01, 0.01])
        result = calculate_calmar_ratio(returns)
        assert result == 0.0

    def test_positive_returns_with_drawdown(self):
        """PRME-PA-002: 正收益但有回撤时卡尔玛比率"""
        returns = np.array([0.1, -0.05, 0.1, -0.05, 0.1])
        result = calculate_calmar_ratio(returns)
        assert result > 0

    def test_negative_mean_returns(self):
        """PRME-PA-002: 负平均收益时卡尔玛比率为负"""
        returns = np.array([-0.01, -0.02, -0.005, -0.01, -0.015])
        result = calculate_calmar_ratio(returns)
        assert result < 0


class TestRiskMetricsEdgeCases:
    """Edge cases for risk metrics."""

    def test_empty_array(self):
        """PRME-PA-002: 空数组处理"""
        returns = np.array([])
        result = calculate_risk_metrics(returns)
        # Should handle gracefully, may contain NaN or 0
        assert "volatility" in result

    def test_single_observation(self):
        """PRME-PA-002: 单观测值处理"""
        returns = np.array([0.01])
        result = calculate_risk_metrics(returns)
        assert result["volatility"] == 0.0
        assert result["sharpe_ratio"] == 0.0

    def test_extreme_values(self):
        """PRME-PA-002: 极端值处理"""
        returns = np.array([0.5, -0.5, 0.3, -0.3, 0.1])
        result = calculate_risk_metrics(returns)
        assert result["volatility"] > 0
        assert result["max_drawdown"] < 0
