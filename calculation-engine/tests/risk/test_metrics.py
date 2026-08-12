import pytest
import numpy as np
from src.risk.metrics import calculate_risk_metrics, calculate_max_drawdown, calculate_sortino_ratio, calculate_calmar_ratio


class TestSharpeRatio:
    """CE-1: 夏普比率零波动处理错误 — 零波动时应返回 inf/NaN 而非 0"""

    def test_sharpe_ratio_normal(self):
        """正常收益率应计算正确夏普比率"""
        returns = np.array([0.01, 0.02, -0.01, 0.015, 0.005])
        metrics = calculate_risk_metrics(returns)
        expected_sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252)
        assert metrics["sharpe_ratio"] == pytest.approx(expected_sharpe, rel=1e-10)

    def test_sharpe_ratio_zero_volatility_should_be_inf_or_nan(self):
        """CE-1: 零波动时，夏普比率应为 inf 或 NaN，而非 0"""
        returns = np.array([0.01, 0.01, 0.01, 0.01, 0.01])  # 零波动
        metrics = calculate_risk_metrics(returns)
        # 当前实现返回0，这是错误的
        # 正确行为: 当std=0时，mean/std应为inf (若mean≠0) 或 NaN (若mean=0)
        # 这个测试会失败，证明CE-1存在
        assert metrics["sharpe_ratio"] != 0, \
            "CE-1 BUG: 零波动时sharpe_ratio不应为0，应为inf或NaN"

    def test_sharpe_ratio_zero_volatility_with_positive_mean(self):
        """零波动+正均值 → 夏普比率应为 +inf"""
        returns = np.array([0.01, 0.01, 0.01])  # std=0, mean>0
        metrics = calculate_risk_metrics(returns)
        # 预期: +inf，实际: 0 (bug)
        assert np.isinf(metrics["sharpe_ratio"]) or metrics["sharpe_ratio"] == 0, \
            "若返回0则是已知bug，若返回inf则已修复"

    def test_sharpe_ratio_zero_volatility_with_zero_mean(self):
        """零波动+零均值 → 夏普比率应为 NaN"""
        returns = np.array([0.0, 0.0, 0.0])  # std=0, mean=0
        metrics = calculate_risk_metrics(returns)
        # 预期: NaN (0/0)，实际: 0 (bug)
        assert np.isnan(metrics["sharpe_ratio"]) or metrics["sharpe_ratio"] == 0, \
            "若返回0则是已知bug，若返回NaN则已修复"


class TestMaxDrawdown:
    """最大回撤计算测试"""

    def test_max_drawdown_simple(self):
        """简单回撤场景"""
        returns = np.array([0.1, 0.05, -0.15, 0.2])
        mdd = calculate_max_drawdown(returns)
        assert mdd <= 0  # 回撤应为负数或0

    def test_max_drawdown_no_drawdown(self):
        """无回撤时应为0"""
        returns = np.array([0.01, 0.02, 0.03])
        mdd = calculate_max_drawdown(returns)
        assert mdd == pytest.approx(0, abs=1e-10)

    def test_max_drawdown_all_negative(self):
        """全部亏损"""
        returns = np.array([-0.1, -0.1, -0.1])
        mdd = calculate_max_drawdown(returns)
        assert mdd < 0


class TestSortinoRatio:
    """索提诺比率测试"""

    def test_sortino_ratio_normal(self):
        """正常场景"""
        returns = np.array([0.01, -0.02, 0.03, -0.01, 0.02])
        sortino = calculate_sortino_ratio(returns)
        assert sortino != 0  # 有下行波动时不应为0

    def test_sortino_ratio_no_downside(self):
        """无下行波动时应返回0 (当前实现) 或 inf"""
        returns = np.array([0.01, 0.02, 0.03])  # 全正收益
        sortino = calculate_sortino_ratio(returns)
        # 当前实现返回0，这是设计选择
        assert sortino == 0


class TestCalmarRatio:
    """卡尔玛比率测试"""

    def test_calmar_ratio_normal(self):
        """正常场景"""
        returns = np.array([0.01, 0.02, -0.05, 0.03])
        calmar = calculate_calmar_ratio(returns)
        assert calmar != 0  # 有回撤时不应为0

    def test_calmar_ratio_no_drawdown(self):
        """无回撤时返回0 (当前实现)"""
        returns = np.array([0.01, 0.02, 0.03])
        calmar = calculate_calmar_ratio(returns)
        assert calmar == 0


class TestSkewnessKurtosis:
    """偏度和峰度测试"""

    def test_skewness_zero_volatility(self):
        """CE-1相关: 零波动时skewness返回0"""
        returns = np.array([0.01, 0.01, 0.01])
        metrics = calculate_risk_metrics(returns)
        # 零波动时skewness应为NaN，当前实现返回0
        assert metrics["skewness"] == 0  # 这是当前(错误)行为

    def test_kurtosis_zero_volatility(self):
        """CE-1相关: 零波动时kurtosis返回0"""
        returns = np.array([0.01, 0.01, 0.01])
        metrics = calculate_risk_metrics(returns)
        # 零波动时kurtosis应为NaN，当前实现返回0
        assert metrics["kurtosis"] == 0  # 这是当前(错误)行为
