from typing import Dict, Optional, Tuple
import numpy as np


def calculate_pe_valuation(
    eps: float,
    pe_ratio_industry: float,
    pe_ratio_historical: Optional[float] = None,
    growth_rate: Optional[float] = None,
    risk_free_rate: float = 0.03,
    method: str = "industry"
) -> Dict:
    """
    PE估值法：市盈率 = 股价 / 每股收益
    合理股价 = EPS × 合理PE
    """
    if not eps or eps <= 0:
        return {"error": "EPS must be positive"}
    
    results = {}
    
    # 行业PE法
    if method in ("industry", "all"):
        price_industry = eps * pe_ratio_industry
        results["industry_pe"] = {
            "pe_ratio": pe_ratio_industry,
            "intrinsic_value": round(price_industry, 2),
            "label": f"行业平均PE({pe_ratio_industry:.1f}x)",
        }
    
    # 历史PE法
    if pe_ratio_historical and method in ("historical", "all"):
        price_historical = eps * pe_ratio_historical
        results["historical_pe"] = {
            "pe_ratio": pe_ratio_historical,
            "intrinsic_value": round(price_historical, 2),
            "label": f"历史平均PE({pe_ratio_historical:.1f}x)",
        }
    
    # 增长调整PE法 (Graham 改良版)
    if growth_rate is not None and method in ("growth", "all"):
        # 合理PE ≈ (8.5 + 2 × 增长率) × 100 / (100 - 风险溢价)
        # 简化版: 合理PE = 增长率 × 100 (PEG=1)
        pe_growth = max(8.5, (growth_rate * 100) * 0.8)  # 保守估计
        price_growth = eps * pe_growth
        results["growth_adjusted"] = {
            "pe_ratio": round(pe_growth, 1),
            "intrinsic_value": round(price_growth, 2),
            "growth_rate": growth_rate,
            "label": f"增长调整PE({pe_growth:.1f}x, 增长率{growth_rate*100:.1f}%)",
        }
    
    # 综合估值 (取各方法中位数或平均)
    values = [r["intrinsic_value"] for r in results.values()]
    if values:
        results["summary"] = {
            "mean_value": round(np.mean(values), 2),
            "median_value": round(np.median(values), 2),
            "range_low": round(min(values) * 0.9, 2),
            "range_high": round(max(values) * 1.1, 2),
        }
    
    return results


def calculate_pb_valuation(
    book_value_per_share: float,
    pb_ratio_industry: float,
    pb_ratio_historical: Optional[float] = None,
    roe: Optional[float] = None,
    method: str = "industry"
) -> Dict:
    """
    PB估值法：市净率 = 股价 / 每股净资产
    合理股价 = 每股净资产 × 合理PB
    """
    if not book_value_per_share or book_value_per_share <= 0:
        return {"error": "Book value per share must be positive"}
    
    results = {}
    
    # 行业PB法
    if method in ("industry", "all"):
        price_industry = book_value_per_share * pb_ratio_industry
        results["industry_pb"] = {
            "pb_ratio": pb_ratio_industry,
            "intrinsic_value": round(price_industry, 2),
            "label": f"行业平均PB({pb_ratio_industry:.1f}x)",
        }
    
    # 历史PB法
    if pb_ratio_historical and method in ("historical", "all"):
        price_historical = book_value_per_share * pb_ratio_historical
        results["historical_pb"] = {
            "pb_ratio": pb_ratio_historical,
            "intrinsic_value": round(price_historical, 2),
            "label": f"历史平均PB({pb_ratio_historical:.1f}x)",
        }
    
    # ROE调整PB法
    if roe is not None and method in ("roe", "all"):
        # 合理PB ≈ ROE / 折现率 (简化)
        # 更精确的: PB = (ROE - g) / (r - g)
        discount_rate = 0.10
        growth_rate = 0.03
        if roe > discount_rate:
            pb_roe = (roe - growth_rate) / (discount_rate - growth_rate)
        else:
            pb_roe = 1.0  # 如果ROE低于折现率，PB趋近于1
        pb_roe = max(0.5, min(pb_roe, 5.0))  # 限制在合理范围
        price_roe = book_value_per_share * pb_roe
        results["roe_adjusted"] = {
            "pb_ratio": round(pb_roe, 2),
            "intrinsic_value": round(price_roe, 2),
            "roe": roe,
            "label": f"ROE调整PB({pb_roe:.2f}x, ROE{roe*100:.1f}%)",
        }
    
    values = [r["intrinsic_value"] for r in results.values()]
    if values:
        results["summary"] = {
            "mean_value": round(np.mean(values), 2),
            "median_value": round(np.median(values), 2),
            "range_low": round(min(values) * 0.9, 2),
            "range_high": round(max(values) * 1.1, 2),
        }
    
    return results


def calculate_dcf_valuation(
    free_cash_flow: float,
    growth_rates: list,
    terminal_growth_rate: float,
    discount_rate: float = 0.10,
    shares_outstanding: float = 1.0,
    net_debt: float = 0.0,
) -> Dict:
    """
    DCF估值法：自由现金流折现
    
    Args:
        free_cash_flow: 基准年自由现金流
        growth_rates: 预测期增长率列表 (如 [0.15, 0.12, 0.10, 0.08, 0.06])
        terminal_growth_rate: 永续增长率
        discount_rate: 折现率 (WACC)
        shares_outstanding: 总股本
        net_debt: 净债务
    """
    if not free_cash_flow or free_cash_flow <= 0:
        return {"error": "Free cash flow must be positive"}
    
    if not growth_rates:
        return {"error": "Growth rates are required"}
    
    if terminal_growth_rate >= discount_rate:
        return {"error": "Terminal growth rate must be less than discount rate"}
    
    # 预测期现金流折现
    pv_fcf = []
    fcf = free_cash_flow
    for year, g in enumerate(growth_rates, 1):
        fcf = fcf * (1 + g)
        pv = fcf / ((1 + discount_rate) ** year)
        pv_fcf.append({
            "year": year,
            "growth_rate": round(g, 4),
            "fcf": round(fcf, 2),
            "pv": round(pv, 2),
        })
    
    # 终值 (Gordon Growth Model)
    last_fcf = fcf * (1 + terminal_growth_rate)
    terminal_value = last_fcf / (discount_rate - terminal_growth_rate)
    pv_terminal = terminal_value / ((1 + discount_rate) ** len(growth_rates))
    
    # 企业价值 = 预测期现值 + 终值现值
    total_pv_fcf = sum(p["pv"] for p in pv_fcf)
    enterprise_value = total_pv_fcf + pv_terminal
    
    # 股权价值 = 企业价值 - 净债务
    equity_value = enterprise_value - net_debt
    intrinsic_value_per_share = equity_value / shares_outstanding if shares_outstanding > 0 else 0
    
    # 敏感性分析
    sensitivity = {}
    for dr in [discount_rate - 0.02, discount_rate, discount_rate + 0.02]:
        for tg in [terminal_growth_rate - 0.01, terminal_growth_rate, terminal_growth_rate + 0.01]:
            if tg >= dr:
                continue
            tv = last_fcf / (dr - tg)
            pv_tv = tv / ((1 + dr) ** len(growth_rates))
            ev = total_pv_fcf + pv_tv
            eq = ev - net_debt
            iv = eq / shares_outstanding if shares_outstanding > 0 else 0
            sensitivity[f"dr{dr*100:.0f}_tg{tg*100:.0f}"] = round(iv, 2)
    
    return {
        "method": "dcf",
        "assumptions": {
            "discount_rate": discount_rate,
            "terminal_growth_rate": terminal_growth_rate,
            "shares_outstanding": shares_outstanding,
            "net_debt": net_debt,
        },
        "forecast_period": pv_fcf,
        "terminal_value": round(terminal_value, 2),
        "pv_terminal": round(pv_terminal, 2),
        "total_pv_fcf": round(total_pv_fcf, 2),
        "enterprise_value": round(enterprise_value, 2),
        "equity_value": round(equity_value, 2),
        "intrinsic_value": round(intrinsic_value_per_share, 2),
        "range_low": round(min(sensitivity.values()) if sensitivity else intrinsic_value_per_share * 0.8, 2),
        "range_high": round(max(sensitivity.values()) if sensitivity else intrinsic_value_per_share * 1.2, 2),
        "sensitivity_analysis": sensitivity,
    }


def calculate_ddm_valuation(
    dividend_per_share: float,
    growth_rate: float,
    discount_rate: float = 0.10,
    multi_stage: Optional[list] = None,
) -> Dict:
    """
    DDM估值法：股息贴现模型
    
    Args:
        dividend_per_share: 最近一年每股股息
        growth_rate: 永续增长率 (单阶段) 或 第一阶段增长率
        discount_rate: 必要回报率
        multi_stage: 多阶段增长率列表，如 [0.10, 0.08, 0.05] 表示3阶段
    """
    if not dividend_per_share or dividend_per_share <= 0:
        return {"error": "Dividend per share must be positive"}
    
    if growth_rate >= discount_rate:
        return {"error": "Growth rate must be less than discount rate"}
    
    # 单阶段 Gordon Growth Model
    if not multi_stage:
        intrinsic_value = dividend_per_share * (1 + growth_rate) / (discount_rate - growth_rate)
        return {
            "method": "ddm_single_stage",
            "dividend_per_share": dividend_per_share,
            "growth_rate": growth_rate,
            "discount_rate": discount_rate,
            "intrinsic_value": round(intrinsic_value, 2),
            "range_low": round(intrinsic_value * 0.85, 2),
            "range_high": round(intrinsic_value * 1.15, 2),
        }
    
    # 多阶段模型
    pv_dividends = []
    dps = dividend_per_share
    total_years = 0
    for stage_g in multi_stage:
        # 每阶段默认3年
        for year in range(3):
            dps = dps * (1 + stage_g)
            pv = dps / ((1 + discount_rate) ** (total_years + year + 1))
            pv_dividends.append({
                "stage": len(pv_dividends) // 3 + 1,
                "year": total_years + year + 1,
                "dividend": round(dps, 2),
                "pv": round(pv, 2),
            })
        total_years += 3
    
    # 终值 (最后阶段的永续增长)
    last_g = multi_stage[-1] if multi_stage else 0.02
    if last_g >= discount_rate:
        last_g = discount_rate - 0.01
    terminal_dps = dps * (1 + last_g)
    terminal_value = terminal_dps / (discount_rate - last_g)
    pv_terminal = terminal_value / ((1 + discount_rate) ** total_years)
    
    total_pv = sum(d["pv"] for d in pv_dividends) + pv_terminal
    
    return {
        "method": "ddm_multi_stage",
        "stages": multi_stage,
        "discount_rate": discount_rate,
        "dividend_forecast": pv_dividends,
        "terminal_value": round(terminal_value, 2),
        "pv_terminal": round(pv_terminal, 2),
        "intrinsic_value": round(total_pv, 2),
        "range_low": round(total_pv * 0.85, 2),
        "range_high": round(total_pv * 1.15, 2),
    }


def calculate_peg_valuation(
    eps: float,
    pe_ratio: float,
    growth_rate: float,
    peg_target: float = 1.0,
) -> Dict:
    """
    PEG估值法：市盈率相对盈利增长比率
    
    合理PE = PEG × 增长率 × 100
    合理股价 = EPS × 合理PE
    
    PEG < 1: 低估
    PEG = 1: 合理
    PEG > 1: 高估
    """
    if not eps or eps <= 0:
        return {"error": "EPS must be positive"}
    
    if not growth_rate or growth_rate <= 0:
        return {"error": "Growth rate must be positive for PEG valuation"}
    
    current_peg = pe_ratio / (growth_rate * 100)
    
    # 基于目标PEG(1.0)的合理PE
    fair_pe = peg_target * growth_rate * 100
    fair_price = eps * fair_pe
    
    # 基于当前PEG的股价
    if current_peg > 0:
        implied_price = eps * pe_ratio
    else:
        implied_price = 0
    
    # 估值判断
    if current_peg < 0.8:
        valuation = "undervalued"
    elif current_peg > 1.2:
        valuation = "overvalued"
    else:
        valuation = "fair"
    
    return {
        "method": "peg",
        "eps": eps,
        "current_pe": pe_ratio,
        "growth_rate": growth_rate,
        "current_peg": round(current_peg, 2),
        "peg_target": peg_target,
        "fair_pe": round(fair_pe, 1),
        "intrinsic_value": round(fair_price, 2),
        "current_implied_price": round(implied_price, 2),
        "valuation": valuation,
        "range_low": round(fair_price * 0.85, 2),
        "range_high": round(fair_price * 1.15, 2),
    }
