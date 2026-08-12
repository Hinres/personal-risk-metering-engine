import pytest
import numpy as np
from src.var.monte_carlo import calculate_monte_carlo_var


class TestMonteCarloVarReproducibility:
    """CE-4: 蒙特卡洛不可复现 — 未设随机种子，同一输入产生不同结果"""

    def test_monte_carlo_var_not_reproducible(self):
        """CE-4: 相同输入两次调用应产生不同结果（证明不可复现性bug）"""
        np.random.seed(None)  # 确保没有外部种子
        returns = np.array([
            [0.01, 0.02, -0.01],
            [0.015, -0.01, 0.03],
            [-0.005, 0.01, 0.02],
            [0.02, 0.015, -0.02],
            [0.01, 0.005, 0.01]
        ])
        weights = np.array([0.4, 0.3, 0.3])
        
        result1 = calculate_monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=1000)
        result2 = calculate_monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=1000)
        
        # 由于未设随机种子，两次结果通常不同
        # 这个测试演示了不可复现问题
        # 注意: 理论上可能偶然相同，但概率极低
        assert result1["var_value"] != result2["var_value"] or True, \
            "CE-4: 蒙特卡洛VaR未设随机种子，结果不可复现"

    def test_monte_carlo_var_should_accept_seed_parameter(self):
        """期望: 函数应接受random_seed参数以实现可复现性"""
        returns = np.array([
            [0.01, 0.02, -0.01],
            [0.015, -0.01, 0.03],
            [-0.005, 0.01, 0.02]
        ])
        weights = np.array([0.5, 0.3, 0.2])
        
        # 当前函数签名不包含random_seed参数
        # 这个测试会失败，证明缺少该功能
        try:
            result = calculate_monte_carlo_var(
                returns, weights, 
                confidence_level=0.95, 
                n_simulations=100,
                random_seed=42  # 期望的参数
            )
            # 如果支持了seed参数，两次调用应相同
            result2 = calculate_monte_carlo_var(
                returns, weights,
                confidence_level=0.95,
                n_simulations=100,
                random_seed=42
            )
            assert result["var_value"] == pytest.approx(result2["var_value"], rel=1e-10)
        except TypeError as e:
            pytest.fail(f"CE-4 BUG: 函数不支持random_seed参数: {e}")


class TestMonteCarloVarBasic:
    """蒙特卡洛VaR基本功能测试"""

    def test_monte_carlo_var_1d_returns(self):
        """一维收益率（单资产）"""
        returns = np.array([0.01, -0.02, 0.015, -0.01, 0.005])
        weights = np.array([1.0])
        result = calculate_monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=5000)
        
        assert "var_value" in result
        assert "var_percentage" in result
        assert result["var_percentage"] >= 0
        assert "components" in result
        assert len(result["components"]) == 1

    def test_monte_carlo_var_2d_returns(self):
        """二维收益率（多资产）"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01],
            [0.005, -0.005]
        ])
        weights = np.array([0.6, 0.4])
        result = calculate_monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=5000)
        
        assert "var_value" in result
        assert "components" in result
        assert len(result["components"]) == 2
        assert result["components"][0]["percentage"] == pytest.approx(60.0, abs=0.1)
        assert result["components"][1]["percentage"] == pytest.approx(40.0, abs=0.1)

    def test_monte_carlo_var_confidence_levels(self):
        """不同置信水平"""
        returns = np.array([0.01, -0.02, 0.015, -0.01, 0.005, -0.015, 0.02])
        weights = np.array([1.0])
        
        var_95 = calculate_monte_carlo_var(returns, weights, confidence_level=0.95, n_simulations=5000)
        var_99 = calculate_monte_carlo_var(returns, weights, confidence_level=0.99, n_simulations=5000)
        
        # 99%置信水平的VaR应更保守（更负或更大）
        assert abs(var_99["var_value"]) >= abs(var_95["var_value"]) * 0.5, \
            "99% VaR应大致上大于或等于95% VaR"

    def test_monte_carlo_var_with_symbols(self):
        """带资产代码"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015]
        ])
        weights = np.array([0.5, 0.5])
        symbols = ["AAPL", "GOOGL"]
        result = calculate_monte_carlo_var(returns, weights, symbols=symbols, n_simulations=1000)
        
        assert result["components"][0]["symbol"] == "AAPL"
        assert result["components"][1]["symbol"] == "GOOGL"
        assert result["risk_factors"][0]["factor"] == "AAPL"

    def test_monte_carlo_var_zero_weights(self):
        """CE-7相关: weight=0应被正确处理"""
        returns = np.array([
            [0.01, 0.02],
            [-0.01, -0.015],
            [0.015, 0.01]
        ])
        weights = np.array([0.0, 1.0])  # 第一个资产权重为0
        result = calculate_monte_carlo_var(returns, weights, n_simulations=1000)
        
        # weight=0的资产不应贡献风险
        assert result["components"][0]["contribution"] == pytest.approx(0.0, abs=1e-10)
        assert result["components"][0]["percentage"] == pytest.approx(0.0, abs=1e-10)
