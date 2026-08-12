import pytest
from src.stress.scenarios import get_scenarios, get_scenario, STRESS_SCENARIOS


class TestStressScenarios:
    """Tests for stress test scenarios module."""

    def test_all_scenarios_present(self):
        """PRME-VAR-003: 压力测试情景数量 >= 10"""
        scenarios = get_scenarios()
        assert len(scenarios) >= 10, f"Only {len(scenarios)} scenarios found, need at least 10"

    def test_scenario_has_required_fields(self):
        """PRME-VAR-003: 每个情景包含必要字段"""
        for scenario_id, scenario in STRESS_SCENARIOS.items():
            assert "name" in scenario, f"Scenario {scenario_id} missing 'name'"
            assert "description" in scenario, f"Scenario {scenario_id} missing 'description'"
            assert "shocks" in scenario, f"Scenario {scenario_id} missing 'shocks'"
            assert isinstance(scenario["shocks"], dict)
            assert len(scenario["shocks"]) > 0, f"Scenario {scenario_id} has no shocks"

    def test_specific_scenarios_exist(self):
        """PRME-VAR-003: 关键历史情景存在"""
        required_scenarios = [
            "2008_financial_crisis",
            "2020_covid_pandemic",
            "2015_a_share_crash",
            "trade_war",
        ]
        for s in required_scenarios:
            assert s in STRESS_SCENARIOS, f"Required scenario '{s}' not found"

    def test_2008_financial_crisis_shocks(self):
        """PRME-VAR-003: 2008金融危机情景参数验证"""
        scenario = get_scenario("2008_financial_crisis")
        assert scenario is not None
        assert scenario["name"] == "2008年金融危机"
        shocks = scenario["shocks"]
        assert "global_equity" in shocks
        assert shocks["global_equity"] == -0.40
        assert "financial_sector" in shocks
        assert shocks["financial_sector"] == -0.60

    def test_2020_covid_pandemic_shocks(self):
        """PRME-VAR-003: 2020疫情情景参数验证"""
        scenario = get_scenario("2020_covid_pandemic")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["global_equity"] == -0.35
        assert shocks["travel_leisure"] == -0.70
        assert shocks["oil"] == -0.50
        assert shocks["tech"] == 0.10  # Tech benefited

    def test_2015_a_share_crash(self):
        """PRME-VAR-003: 2015A股股灾情景验证"""
        scenario = get_scenario("2015_a_share_crash")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["china_equity"] == -0.30
        assert shocks["small_cap"] == -0.45
        assert shocks["margin_stocks"] == -0.50

    def test_russia_ukraine_energy_shock(self):
        """PRME-VAR-003: 俄乌冲突能源暴涨情景"""
        scenario = get_scenario("2022_russia_ukraine")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["energy"] == 0.60
        assert shocks["agriculture"] == 0.40
        assert shocks["europe_equity"] == -0.25

    def test_inflation_shock_rates(self):
        """PRME-VAR-003: 通胀情景利率冲击为正"""
        scenario = get_scenario("inflation_shock")
        shocks = scenario["shocks"]
        assert shocks["interest_rates"] > 0  # Rates go up
        assert shocks["bonds"] < 0  # Bonds fall
        assert shocks["growth_stocks"] < 0

    def test_dotcom_bubble_tech_crash(self):
        """PRME-VAR-003: 科技泡沫情景科技股暴跌"""
        scenario = get_scenario("dotcom_bubble")
        shocks = scenario["shocks"]
        assert shocks["tech_sector"] == -0.70
        assert shocks["nasdaq"] == -0.65

    def test_scenario_shock_ranges(self):
        """PRME-VAR-003: 冲击值在合理范围 [-1, 1]"""
        for scenario_id, scenario in STRESS_SCENARIOS.items():
            for factor, shock in scenario["shocks"].items():
                assert -1.0 <= shock <= 1.0, (
                    f"Scenario {scenario_id} factor {factor} shock {shock} out of range"
                )

    def test_get_scenario_returns_none_for_invalid(self):
        """获取不存在的情景返回None"""
        assert get_scenario("non_existent_scenario") is None

    def test_scenario_ids_are_strings(self):
        """所有情景ID为字符串"""
        for sid in STRESS_SCENARIOS.keys():
            assert isinstance(sid, str)
            assert len(sid) > 0

    def test_scenario_names_are_chinese(self):
        """情景名称包含中文"""
        for scenario in STRESS_SCENARIOS.values():
            assert any('\u4e00' <= c <= '\u9fff' for c in scenario["name"])

    def test_rate_shock_scenario(self):
        """PRME-VAR-003: 利率急升情景验证"""
        scenario = get_scenario("rate_shock")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["interest_rates"] == 0.05
        assert shocks["growth_stocks"] == -0.35
        assert shocks["real_estate"] == -0.30

    def test_liquidity_crisis_scenario(self):
        """PRME-VAR-003: 流动性危机情景验证"""
        scenario = get_scenario("liquidity_crisis")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["global_equity"] == -0.30
        assert shocks["credit_spreads"] == 0.10
        assert shocks["small_cap"] == -0.45

    def test_commodity_surge_scenario(self):
        """PRME-VAR-003: 大宗商品暴涨情景验证"""
        scenario = get_scenario("commodity_surge")
        assert scenario is not None
        shocks = scenario["shocks"]
        assert shocks["commodities"] == 0.50
        assert shocks["energy"] == 0.40
        assert shocks["materials"] == 0.35

    def test_scenario_count_exactly_11(self):
        """PRME-VAR-003: 确认有11个预设情景"""
        assert len(STRESS_SCENARIOS) == 11
