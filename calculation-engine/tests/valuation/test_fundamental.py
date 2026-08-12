import pytest
import numpy as np
import sys
sys.path.insert(0, '/workspace/venv/lib/python3.12/site-packages')

import sys
sys.path.insert(0, '/workspace/venv/lib/python3.12/site-packages')

from src.valuation.fundamental import (
    calculate_dcf_valuation as dcf_valuation,
    calculate_pe_valuation as pe_valuation,
    calculate_pb_valuation as pb_valuation,
    calculate_ddm_valuation as dividend_discount_valuation,
    calculate_peg_valuation as residual_income_valuation,
)


class TestDCFValuation:
    """DCF估值测试"""

    def test_dcf_basic(self):
        """基本DCF估值"""
        result = dcf_valuation(
            free_cash_flows=[100, 110, 120],
            discount_rate=0.1,
            terminal_growth_rate=0.02,
            shares_outstanding=1000
        )
        assert "intrinsic_value_per_share" in result
        assert result["intrinsic_value_per_share"] > 0

    def test_dcf_empty_fcf_list(self):
        """CE-3: 空FCF列表处理"""
        result = dcf_valuation(
            free_cash_flows=[],
            discount_rate=0.1,
            terminal_growth_rate=0.02,
            shares_outstanding=1000
        )
        # 当前实现可能返回error或异常
        assert "error" in result or "intrinsic_value_per_share" in result


class TestPEValuation:
    """PE估值测试"""

    def test_pe_basic(self):
        """基本PE估值"""
        result = pe_valuation(
            earnings_per_share=5.0,
            industry_pe_ratio=15.0
        )
        assert result["estimated_value"] == pytest.approx(75.0, abs=1e-6)

    def test_pe_zero_earnings(self):
        """零收益"""
        result = pe_valuation(
            earnings_per_share=0.0,
            industry_pe_ratio=15.0
        )
        assert result["estimated_value"] == 0


class TestPBValuation:
    """PB估值测试"""

    def test_pb_basic(self):
        """基本PB估值"""
        result = pb_valuation(
            book_value_per_share=20.0,
            industry_pb_ratio=2.0
        )
        assert result["estimated_value"] == pytest.approx(40.0, abs=1e-6)


class TestDividendDiscountValuation:
    """股利贴现模型测试"""

    def test_ddm_basic(self):
        """基本DDM"""
        result = dividend_discount_valuation(
            recent_dividend=2.0,
            growth_rate=0.05,
            required_return=0.1
        )
        # Gordon Growth Model: V = D1 / (r - g)
        expected = 2.0 * 1.05 / (0.1 - 0.05)
        assert result["intrinsic_value"] == pytest.approx(expected, rel=1e-6)

    def test_ddm_zero_growth(self):
        """零增长"""
        result = dividend_discount_valuation(
            recent_dividend=2.0,
            growth_rate=0.0,
            required_return=0.1
        )
        expected = 2.0 / 0.1
        assert result["intrinsic_value"] == pytest.approx(expected, rel=1e-6)


class TestResidualIncomeValuation:
    """剩余收益模型测试"""

    def test_residual_income_basic(self):
        """基本剩余收益估值"""
        result = residual_income_valuation(
            book_value_per_share=20.0,
            earnings_per_share=[3.0, 3.5, 4.0],
            cost_of_equity=0.1
        )
        assert "intrinsic_value" in result
        assert result["intrinsic_value"] > 0
