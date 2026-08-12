import pytest
import numpy as np
from src.var.historical import calculate_historical_var
from src.var.parametric import calculate_parametric_var
from src.var.monte_carlo import calculate_monte_carlo_var


class TestHistoricalVaR:
    """Tests for historical simulation VaR method."""

    def test_single_asset_historical_var(self):
        """PRME-VAR-001: 历史模拟法单资产VaR计算"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 1000)
        result = calculate_historical_var(returns, np.array([1.0]))
        assert "var_value" in result
        assert result["var_value"] < 0  # VaR should be negative (loss)
        assert result["expected_return"] == pytest.approx(0.001, abs=0.005)
        assert result["volatility"] > 0

    def test_multi_asset_historical_var(self):
        """PRME-VAR-001: 历史模拟法多资产组合VaR"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 1000
        )
        weights = np.array([0.6, 0.4])
        result = calculate_historical_var(
            returns, weights, confidence_level=0.95, symbols=["AAPL", "MSFT"]
        )
        assert "var_value" in result
        assert "components" in result
        assert len(result["components"]) == 2
        assert result["components"][0]["symbol"] == "AAPL"
        assert result["components"][1]["symbol"] == "MSFT"
        assert result["risk_factors"] is not None

    def test_confidence_level_99(self):
        """PRME-VAR-001: 99%置信度VaR应大于95%"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 1000)
        var_95 = calculate_historical_var(returns, np.array([1.0]), confidence_level=0.95)
        var_99 = calculate_historical_var(returns, np.array([1.0]), confidence_level=0.99)
        # 99% VaR should be more negative (larger loss) than 95%
        assert var_99["var_value"] <= var_95["var_value"]

    def test_var_percentage_calculation(self):
        """PRME-VAR-001: VaR百分比计算正确"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 1000)
        result = calculate_historical_var(returns, np.array([1.0]))
        assert result["var_percentage"] == abs(result["var_value"]) * 100
        assert result["var_percentage"] > 0

    def test_risk_factors_present(self):
        """PRME-VAR-001: 风险因子分解存在"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002, 0.0005],
            [[0.0004, 0.0001, 0.00005], [0.0001, 0.0009, 0.0001], [0.00005, 0.0001, 0.0006]],
            1000,
        )
        weights = np.array([0.5, 0.3, 0.2])
        result = calculate_historical_var(returns, weights, symbols=["A", "B", "C"])
        assert len(result["risk_factors"]) > 0
        total_contribution = sum(
            abs(rf["contribution"]) for rf in result["risk_factors"]
        )
        assert total_contribution > 0

    def test_equal_weights_portfolio(self):
        """PRME-VAR-001: 等权重组合VaR"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.001], [[0.0004, 0.0001], [0.0001, 0.0004]], 1000
        )
        weights = np.array([0.5, 0.5])
        result = calculate_historical_var(returns, weights)
        assert result["var_value"] < 0


class TestParametricVaR:
    """Tests for parametric (variance-covariance) VaR method."""

    def test_parametric_var_basic(self):
        """PRME-VAR-001: 参数法VaR基础计算"""
        mean_return = 0.001
        std_dev = 0.02
        result = calculate_parametric_var(mean_return, std_dev, confidence_level=0.95)
        assert "var_value" in result
        assert result["var_value"] < 0
        assert result["expected_return"] == mean_return
        assert result["volatility"] == std_dev

    def test_parametric_var_95_confidence(self):
        """PRME-VAR-001: 95%置信度参数法VaR精度验证"""
        # For normal distribution, 95% VaR ≈ μ - 1.645 * σ
        mean_return = 0.0
        std_dev = 0.01
        result = calculate_parametric_var(mean_return, std_dev, confidence_level=0.95)
        expected_var = -1.645 * std_dev
        assert result["var_value"] == pytest.approx(expected_var, abs=0.0001)

    def test_parametric_var_99_confidence(self):
        """PRME-VAR-001: 99%置信度参数法VaR精度验证"""
        # For normal distribution, 99% VaR ≈ μ - 2.326 * σ
        mean_return = 0.0
        std_dev = 0.01
        result = calculate_parametric_var(mean_return, std_dev, confidence_level=0.99)
        expected_var = -2.326 * std_dev
        assert result["var_value"] == pytest.approx(expected_var, abs=0.0001)

    def test_var_percentage(self):
        """PRME-VAR-001: 参数法VaR百分比转换"""
        result = calculate_parametric_var(0.001, 0.02, confidence_level=0.95)
        assert result["var_percentage"] == abs(result["var_value"]) * 100

    def test_zero_volatility(self):
        """PRME-VAR-001: 波动率为0时VaR应等于均值"""
        result = calculate_parametric_var(0.001, 0.0, confidence_level=0.95)
        assert result["var_value"] == 0.001
        assert result["volatility"] == 0.0

    def test_negative_mean(self):
        """PRME-VAR-001: 负均值情况"""
        result = calculate_parametric_var(-0.001, 0.02, confidence_level=0.95)
        assert result["var_value"] < -0.001  # More negative than mean


class TestMonteCarloVaR:
    """Tests for Monte Carlo simulation VaR method."""

    def test_monte_carlo_single_asset(self):
        """PRME-VAR-001: 蒙特卡洛法单资产VaR"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 500)
        result = calculate_monte_carlo_var(
            returns, np.array([1.0]), confidence_level=0.95, n_simulations=5000
        )
        assert "var_value" in result
        assert result["var_value"] < 0
        assert result["volatility"] > 0

    def test_monte_carlo_multi_asset(self):
        """PRME-VAR-001: 蒙特卡洛法多资产组合VaR"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 500
        )
        weights = np.array([0.6, 0.4])
        result = calculate_monte_carlo_var(
            returns, weights, confidence_level=0.95, symbols=["AAPL", "MSFT"]
        )
        assert len(result["components"]) == 2
        assert result["components"][0]["symbol"] == "AAPL"
        assert result["risk_factors"] is not None

    def test_simulation_count(self):
        """PRME-VAR-001: 不同模拟次数的影响"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 500)
        result_1k = calculate_monte_carlo_var(
            returns, np.array([1.0]), n_simulations=1000
        )
        result_10k = calculate_monte_carlo_var(
            returns, np.array([1.0]), n_simulations=10000
        )
        # Both should be negative and in similar range
        assert result_1k["var_value"] < 0
        assert result_10k["var_value"] < 0
        assert abs(result_1k["var_value"] - result_10k["var_value"]) < 0.02

    def test_volatility_consistency(self):
        """PRME-VAR-001: 蒙特卡洛波动率应与输入一致"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 1000)
        result = calculate_monte_carlo_var(
            returns, np.array([1.0]), n_simulations=10000
        )
        # Simulated volatility should be close to input volatility
        assert result["volatility"] == pytest.approx(0.02, abs=0.005)

    def test_risk_factors_top5(self):
        """PRME-VAR-001: 风险因子最多返回前5个"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001] * 10, np.eye(10) * 0.0004, 500
        )
        weights = np.ones(10) / 10
        symbols = [f"Asset_{i}" for i in range(10)]
        result = calculate_monte_carlo_var(returns, weights, symbols=symbols)
        assert len(result["risk_factors"]) <= 5


class TestVaRMethodComparison:
    """Compare VaR results across methods for consistency."""

    def test_methods_similar_range(self):
        """PRME-VAR-001: 三种方法VaR结果应在合理范围内一致"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 2000)
        weights = np.array([1.0])

        hist = calculate_historical_var(returns, weights, confidence_level=0.95)
        para = calculate_parametric_var(
            np.mean(returns), np.std(returns), confidence_level=0.95
        )
        mc = calculate_monte_carlo_var(returns, weights, confidence_level=0.95)

        # All three methods should produce VaR in similar range
        vars = [hist["var_value"], para["var_value"], mc["var_value"]]
        max_diff = max(vars) - min(vars)
        assert max_diff < 0.02, f"VaR methods differ too much: {vars}"

    def test_all_methods_return_expected_keys(self):
        """PRME-VAR-001: 所有方法返回一致的数据结构"""
        np.random.seed(42)
        returns = np.random.normal(0.001, 0.02, 500)
        weights = np.array([1.0])

        expected_keys = {"var_value", "var_percentage", "expected_return", "volatility", "components", "risk_factors"}

        hist = calculate_historical_var(returns, weights)
        para = calculate_parametric_var(np.mean(returns), np.std(returns))
        mc = calculate_monte_carlo_var(returns, weights)

        for result, name in [(hist, "historical"), (para, "parametric"), (mc, "monte_carlo")]:
            missing = expected_keys - set(result.keys())
            assert not missing, f"{name} missing keys: {missing}"

    def test_multi_asset_consistency(self):
        """PRME-VAR-001: 多资产组合三种方法一致性"""
        np.random.seed(42)
        returns = np.random.multivariate_normal(
            [0.001, 0.002], [[0.0004, 0.0001], [0.0001, 0.0009]], 2000
        )
        weights = np.array([0.5, 0.5])

        hist = calculate_historical_var(returns, weights, confidence_level=0.95)
        mc = calculate_monte_carlo_var(returns, weights, confidence_level=0.95)

        # Historical and Monte Carlo should be in similar range
        diff = abs(hist["var_value"] - mc["var_value"])
        assert diff < 0.02, f"Historical vs Monte Carlo diff: {diff}"


class TestVaREdgeCases:
    """Edge cases for VaR calculations."""

    def test_historical_with_empty_returns(self):
        """历史模拟法：空序列"""
        returns = np.array([])
        result = calculate_historical_var(returns, np.array([1.0]))
        # Should handle gracefully (may return NaN or error)
        assert "var_value" in result

    def test_parametric_with_zero_std(self):
        """参数法：零标准差"""
        result = calculate_parametric_var(0.0, 0.0, confidence_level=0.95)
        assert result["var_value"] == 0.0

    def test_monte_carlo_with_single_observation(self):
        """蒙特卡洛：单观测值"""
        returns = np.array([0.01])
        result = calculate_monte_carlo_var(returns, np.array([1.0]), n_simulations=100)
        assert "var_value" in result

    def test_1d_returns_historical(self):
        """历史模拟：一维收益率数组"""
        returns = np.array([0.01, -0.02, 0.005, -0.01, 0.015])
        result = calculate_historical_var(returns, np.array([1.0]))
        assert result["var_value"] < 0
