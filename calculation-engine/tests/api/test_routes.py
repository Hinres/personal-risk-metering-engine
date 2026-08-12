import pytest
import numpy as np
import sys
sys.path.insert(0, '/workspace/venv/lib/python3.12/site-packages')

from src.api.routes.var import calculate_portfolio_var
from src.api.routes.risk import calculate_portfolio_risk


class TestVarRouteWeightHandling:
    """CE-7: var.py weight=0 被误判为缺失"""

    def test_weight_zero_should_not_be_overwritten(self):
        """CE-7: weight=0 不应被覆盖为均等权重"""
        # 模拟PortfolioHolding对象
        class MockHolding:
            def __init__(self, symbol, weight, quantity=100):
                self.symbol = symbol
                self.weight = weight
                self.quantity = quantity
        
        holdings = [
            MockHolding("AAPL", 0.0),   # 用户明确设置weight=0
            MockHolding("GOOGL", 1.0),  # 另一个资产
        ]
        
        # 当前var.py中的逻辑: h.weight or 1.0/n_assets
        # 当weight=0时，Python的or会将0视为False，从而覆盖为1.0/n_assets
        n_assets = len(holdings)
        for h in holdings:
            weight = h.weight or 1.0 / n_assets  # 这是当前实现的逻辑
            if h.symbol == "AAPL" and h.weight == 0:
                # 这个断言会失败，证明CE-7存在
                assert weight == 0, \
                    f"CE-7 BUG: weight=0被误判为缺失，实际得到{weight}而非0"

    def test_weight_none_should_default_to_equal(self):
        """weight=None时应默认均等权重"""
        class MockHolding:
            def __init__(self, symbol, weight=None):
                self.symbol = symbol
                self.weight = weight
        
        holdings = [MockHolding("AAPL"), MockHolding("GOOGL")]
        n_assets = len(holdings)
        
        for h in holdings:
            # 正确的逻辑应该是: h.weight if h.weight is not None else 1.0/n_assets
            weight = h.weight if h.weight is not None else 1.0 / n_assets
            assert weight == pytest.approx(0.5, abs=1e-10)

    def test_weight_positive_should_preserve(self):
        """正权重应保持不变"""
        class MockHolding:
            def __init__(self, symbol, weight):
                self.symbol = symbol
                self.weight = weight
        
        h = MockHolding("AAPL", 0.3)
        # 当前逻辑
        weight = h.weight or 1.0 / 3
        assert weight == pytest.approx(0.3, abs=1e-10)


class TestRiskRouteMockData:
    """CE-6: risk.py 硬编码mock数据"""

    def test_risk_route_returns_mock_data(self):
        """CE-6: 验证risk.py返回的是mock数据而非真实计算"""
        # 由于risk.py硬编码了np.random.seed(42)并返回随机数
        # 这个测试验证当前(错误)行为
        
        # 模拟调用
        # 当前risk.py的实现:
        # np.random.seed(42)
        # metrics = {
        #     "volatility": float(np.random.uniform(0.1, 0.3)),
        #     ...
        # }
        
        # 我们无法直接导入测试，因为FastAPI路由依赖请求对象
        # 但可以通过检查源码确认行为
        import inspect
        from src.api.routes import risk as risk_module
        source = inspect.getsource(risk_module)
        
        # 验证源码中包含硬编码的随机种子和随机数生成
        assert "np.random.seed" in source, "CE-6: risk.py包含硬编码随机种子"
        assert "np.random.uniform" in source or "np.random.normal" in source, \
            "CE-6: risk.py使用随机数生成而非真实计算"
