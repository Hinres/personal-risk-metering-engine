import pytest
import numpy as np
from src.valuation.fundamental import (
    calculate_pe_valuation,
    calculate_pb_valuation,
    calculate_dcf_valuation,
    calculate_ddm_valuation,
    calculate_peg_valuation,
)


class TestPEValuation:
    """Tests for PE (Price-to-Earnings) valuation method."""

    def test_industry_pe_basic(self):
        """SV-FUNC-001: PE估值基础计算 - 行业PE法"""
        result = calculate_pe_valuation(eps=5.0, pe_ratio_industry=15.0, method="industry")
        assert "error" not in result
        assert result["industry_pe"]["intrinsic_value"] == 75.0
        assert result["industry_pe"]["pe_ratio"] == 15.0

    def test_all_methods_combined(self):
        """SV-FUNC-001: PE估值多方法综合"""
        result = calculate_pe_valuation(
            eps=5.0,
            pe_ratio_industry=15.0,
            pe_ratio_historical=18.0,
            growth_rate=0.12,
            method="all",
        )
        assert "industry_pe" in result
        assert "historical_pe" in result
        assert "growth_adjusted" in result
        assert "summary" in result
        summary = result["summary"]
        assert "mean_value" in summary
        assert "median_value" in summary
        assert summary["range_low"] < summary["range_high"]

    def test_eps_must_be_positive(self):
        """PE估值：EPS必须为正数"""
        result = calculate_pe_valuation(eps=-1.0, pe_ratio_industry=15.0)
        assert "error" in result
        result_zero = calculate_pe_valuation(eps=0, pe_ratio_industry=15.0)
        assert "error" in result_zero

    def test_growth_adjusted_pe(self):
        """SV-FUNC-001: 增长调整PE法"""
        result = calculate_pe_valuation(
            eps=5.0, pe_ratio_industry=15.0, growth_rate=0.15, method="growth"
        )
        assert "growth_adjusted" in result
        ga = result["growth_adjusted"]
        assert ga["growth_rate"] == 0.15
        assert ga["intrinsic_value"] > 0

    def test_summary_statistics(self):
        """SV-FUNC-001: 估值汇总统计正确性"""
        result = calculate_pe_valuation(
            eps=10.0,
            pe_ratio_industry=20.0,
            pe_ratio_historical=25.0,
            method="all",
        )
        summary = result["summary"]
        # mean of [200, 250] = 225
        assert summary["mean_value"] == 225.0
        # median of [200, 250] = 225
        assert summary["median_value"] == 225.0
        # range_low = 200 * 0.9 = 180
        assert summary["range_low"] == 180.0
        # range_high = 250 * 1.1 = 275
        assert summary["range_high"] == 275.0


class TestPBValuation:
    """Tests for PB (Price-to-Book) valuation method."""

    def test_industry_pb_basic(self):
        """SV-FUNC-001: PB估值基础计算 - 行业PB法"""
        result = calculate_pb_valuation(
            book_value_per_share=20.0, pb_ratio_industry=2.0, method="industry"
        )
        assert "error" not in result
        assert result["industry_pb"]["intrinsic_value"] == 40.0

    def test_roe_adjusted_pb(self):
        """SV-FUNC-001: ROE调整PB法"""
        result = calculate_pb_valuation(
            book_value_per_share=20.0,
            pb_ratio_industry=2.0,
            roe=0.15,
            method="roe",
        )
        assert "roe_adjusted" in result
        ra = result["roe_adjusted"]
        assert ra["pb_ratio"] > 0
        assert ra["intrinsic_value"] > 0
        assert ra["roe"] == 0.15

    def test_book_value_must_be_positive(self):
        """PB估值：每股净资产必须为正"""
        result = calculate_pb_valuation(
            book_value_per_share=-5.0, pb_ratio_industry=2.0
        )
        assert "error" in result

    def test_pb_bounds_when_roe_low(self):
        """ROE低于折现率时，PB应趋近于1（下限0.5）"""
        result = calculate_pb_valuation(
            book_value_per_share=10.0,
            pb_ratio_industry=2.0,
            roe=0.05,
            method="roe",
        )
        ra = result["roe_adjusted"]
        assert 0.5 <= ra["pb_ratio"] <= 5.0


class TestDCFValuation:
    """Tests for DCF (Discounted Cash Flow) valuation method."""

    def test_dcf_basic_calculation(self):
        """SV-FUNC-001: DCF估值基础计算"""
        result = calculate_dcf_valuation(
            free_cash_flow=100.0,
            growth_rates=[0.15, 0.12, 0.10, 0.08, 0.06],
            terminal_growth_rate=0.03,
            discount_rate=0.10,
            shares_outstanding=10.0,
            net_debt=50.0,
        )
        assert "error" not in result
        assert result["method"] == "dcf"
        assert result["intrinsic_value"] > 0
        assert result["enterprise_value"] > 0
        assert result["equity_value"] > 0
        assert len(result["forecast_period"]) == 5

    def test_terminal_growth_must_be_less_than_discount_rate(self):
        """DCF：永续增长率必须小于折现率"""
        result = calculate_dcf_valuation(
            free_cash_flow=100.0,
            growth_rates=[0.10],
            terminal_growth_rate=0.12,
            discount_rate=0.10,
        )
        assert "error" in result

    def test_fcf_must_be_positive(self):
        """DCF：自由现金流必须为正"""
        result = calculate_dcf_valuation(
            free_cash_flow=-10.0,
            growth_rates=[0.10],
            terminal_growth_rate=0.02,
            discount_rate=0.10,
        )
        assert "error" in result

    def test_sensitivity_analysis_present(self):
        """DCF：敏感性分析结果存在"""
        result = calculate_dcf_valuation(
            free_cash_flow=100.0,
            growth_rates=[0.10, 0.08],
            terminal_growth_rate=0.03,
            discount_rate=0.10,
        )
        assert "sensitivity_analysis" in result
        sa = result["sensitivity_analysis"]
        assert len(sa) > 0
        # Range bounds derived from sensitivity
        assert result["range_low"] <= result["intrinsic_value"] <= result["range_high"]

    def test_pv_terminal_less_than_terminal_value(self):
        """DCF：终值现值应小于终值"""
        result = calculate_dcf_valuation(
            free_cash_flow=100.0,
            growth_rates=[0.10],
            terminal_growth_rate=0.02,
            discount_rate=0.10,
        )
        assert result["pv_terminal"] < result["terminal_value"]


class TestDDMValuation:
    """Tests for DDM (Dividend Discount Model) valuation method."""

    def test_single_stage_ddm(self):
        """SV-FUNC-001: 单阶段DDM估值"""
        result = calculate_ddm_valuation(
            dividend_per_share=2.0,
            growth_rate=0.05,
            discount_rate=0.10,
        )
        assert "error" not in result
        assert result["method"] == "ddm_single_stage"
        # intrinsic_value = 2 * 1.05 / (0.10 - 0.05) = 42.0
        assert result["intrinsic_value"] == 42.0
        assert result["range_low"] == round(42.0 * 0.85, 2)
        assert result["range_high"] == round(42.0 * 1.15, 2)

    def test_multi_stage_ddm(self):
        """SV-FUNC-001: 多阶段DDM估值"""
        result = calculate_ddm_valuation(
            dividend_per_share=2.0,
            growth_rate=0.03,
            discount_rate=0.10,
            multi_stage=[0.12, 0.08, 0.05],
        )
        assert "error" not in result
        assert result["method"] == "ddm_multi_stage"
        assert "dividend_forecast" in result
        assert "terminal_value" in result
        assert result["intrinsic_value"] > 0

    def test_dividend_must_be_positive(self):
        """DDM：股息必须为正"""
        result = calculate_ddm_valuation(
            dividend_per_share=-1.0, growth_rate=0.03, discount_rate=0.10
        )
        assert "error" in result

    def test_growth_rate_must_be_less_than_discount_rate(self):
        """DDM：增长率必须小于折现率"""
        result = calculate_ddm_valuation(
            dividend_per_share=2.0, growth_rate=0.12, discount_rate=0.10
        )
        assert "error" in result


class TestPEGValuation:
    """Tests for PEG (Price/Earnings-to-Growth) valuation method."""

    def test_peg_basic(self):
        """SV-FUNC-001: PEG估值基础计算"""
        result = calculate_peg_valuation(
            eps=5.0, pe_ratio=20.0, growth_rate=0.15, peg_target=1.0
        )
        assert "error" not in result
        assert result["method"] == "peg"
        # current_peg = 20 / (0.15 * 100) = 1.33
        assert result["current_peg"] == pytest.approx(1.33, abs=0.01)
        # fair_pe = 1.0 * 0.15 * 100 = 15.0
        assert result["fair_pe"] == 15.0
        # intrinsic_value = 5 * 15 = 75.0
        assert result["intrinsic_value"] == 75.0

    def test_peg_valuation_judgment(self):
        """SV-FUNC-001: PEG估值判断（高估/合理/低估）"""
        undervalued = calculate_peg_valuation(
            eps=5.0, pe_ratio=10.0, growth_rate=0.15
        )
        assert undervalued["valuation"] == "undervalued"
        assert undervalued["current_peg"] < 0.8

        overvalued = calculate_peg_valuation(
            eps=5.0, pe_ratio=25.0, growth_rate=0.15
        )
        assert overvalued["valuation"] == "overvalued"
        assert overvalued["current_peg"] > 1.2

        fair = calculate_peg_valuation(
            eps=5.0, pe_ratio=14.0, growth_rate=0.15
        )
        assert fair["valuation"] == "fair"

    def test_eps_must_be_positive(self):
        """PEG：EPS必须为正"""
        result = calculate_peg_valuation(
            eps=-1.0, pe_ratio=20.0, growth_rate=0.15
        )
        assert "error" in result

    def test_growth_rate_must_be_positive(self):
        """PEG：增长率必须为正"""
        result = calculate_peg_valuation(
            eps=5.0, pe_ratio=20.0, growth_rate=-0.05
        )
        assert "error" in result

    def test_peg_target_variation(self):
        """PEG：不同目标PEG的影响"""
        result_08 = calculate_peg_valuation(
            eps=5.0, pe_ratio=20.0, growth_rate=0.15, peg_target=0.8
        )
        result_10 = calculate_peg_valuation(
            eps=5.0, pe_ratio=20.0, growth_rate=0.15, peg_target=1.0
        )
        result_12 = calculate_peg_valuation(
            eps=5.0, pe_ratio=20.0, growth_rate=0.15, peg_target=1.2
        )
        assert result_08["intrinsic_value"] < result_10["intrinsic_value"]
        assert result_10["intrinsic_value"] < result_12["intrinsic_value"]


class TestValuationEdgeCases:
    """Edge cases and boundary tests for all valuation methods."""

    def test_pe_with_zero_historical_pe(self):
        """PE估值：historical_pe为0时应忽略"""
        result = calculate_pe_valuation(
            eps=5.0, pe_ratio_industry=15.0, pe_ratio_historical=0, method="all"
        )
        assert "historical_pe" not in result
        assert "industry_pe" in result

    def test_pb_with_zero_historical_pb(self):
        """PB估值：historical_pb为0时应忽略"""
        result = calculate_pb_valuation(
            book_value_per_share=20.0,
            pb_ratio_industry=2.0,
            pb_ratio_historical=0,
            method="all",
        )
        assert "historical_pb" not in result
        assert "industry_pb" in result

    def test_dcf_single_year_forecast(self):
        """DCF：单年预测期"""
        result = calculate_dcf_valuation(
            free_cash_flow=100.0,
            growth_rates=[0.10],
            terminal_growth_rate=0.02,
            discount_rate=0.10,
        )
        assert len(result["forecast_period"]) == 1
        assert result["forecast_period"][0]["year"] == 1

    def test_ddm_no_multi_stage(self):
        """DDM：无multi_stage时默认为单阶段"""
        result = calculate_ddm_valuation(
            dividend_per_share=1.0, growth_rate=0.03, discount_rate=0.08
        )
        assert result["method"] == "ddm_single_stage"
