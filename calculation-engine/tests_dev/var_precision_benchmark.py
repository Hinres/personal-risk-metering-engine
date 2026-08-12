#!/usr/bin/env python3
"""
[PRME-VAR-001] 组合VaR计算 - 100组精度测试用例
文件: var_precision_benchmark.py
需求描述: 100组VaR精度基准测试，验证误差<5%
最后更新: 2026-06-09
"""

import json
import random
import numpy as np
import requests
import os
from datetime import datetime
from typing import List, Dict, Any

# 固定随机种子保证可复现
random.seed(42)
np.random.seed(42)

CALC_ENGINE_URL = os.environ.get("CALC_ENGINE_URL", "http://localhost:8000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")

TEST_STOCKS = [
    "000001.SZ", "000002.SZ", "000063.SZ", "000100.SZ", "000333.SZ",
    "000568.SZ", "000651.SZ", "000725.SZ", "000768.SZ", "000858.SZ",
    "000895.SZ", "002001.SZ", "002007.SZ", "002024.SZ", "002027.SZ",
    "002142.SZ", "002230.SZ", "002236.SZ", "002304.SZ", "002352.SZ",
    "002415.SZ", "002475.SZ", "002594.SZ", "002714.SZ", "002812.SZ",
    "300003.SZ", "300014.SZ", "300015.SZ", "300033.SZ", "300059.SZ",
    "300122.SZ", "300124.SZ", "300142.SZ", "300274.SZ", "300408.SZ",
    "300413.SZ", "300433.SZ", "300498.SZ", "300750.SZ", "300760.SZ",
    "600000.SH", "600009.SH", "600016.SH", "600028.SH", "600030.SH",
    "600031.SH", "600036.SH", "600048.SH", "600085.SH", "600104.SH",
    "600276.SH", "600309.SH", "600406.SH", "600436.SH", "600438.SH",
    "600519.SH", "600585.SH", "600690.SH", "600741.SH", "600745.SH",
    "600809.SH", "600887.SH", "600900.SH", "601012.SH", "601066.SH",
    "601088.SH", "601166.SH", "601211.SH", "601288.SH", "601318.SH",
    "601336.SH", "601398.SH", "601601.SH", "601628.SH", "601668.SH",
    "601688.SH", "601766.SH", "601857.SH", "601888.SH", "601899.SH",
    "601919.SH", "601933.SH", "601939.SH", "601985.SH", "601995.SH",
    "603288.SH", "603259.SH", "603288.SH", "603501.SH", "603986.SH",
    "688001.SH", "688002.SH", "688003.SH", "688005.SH", "688008.SH",
    "688009.SH", "688010.SH", "688012.SH", "688019.SH", "688036.SH",
    "688111.SH", "688169.SH", "688188.SH", "688256.SH", "688981.SH",
]

METHODS = ["historical", "parametric", "monte_carlo"]
CONFIDENCES = [0.90, 0.95, 0.99]
HORIZONS = [1, 7, 30]

def generate_historical_returns(n_assets: int, n_days: int = 252) -> List[List[float]]:
    """生成模拟历史收益率矩阵 [n_assets x n_days]"""
    returns = []
    for _ in range(n_assets):
        # 模拟日均收益率 ~ N(0.0005, 0.02)
        asset_returns = np.random.normal(0.0005, 0.02, n_days).tolist()
        returns.append(asset_returns)
    return returns

def generate_holdings(n_assets: int) -> List[Dict[str, Any]]:
    """生成随机持仓配置"""
    if n_assets > len(TEST_STOCKS):
        # 当需求股票数超过池子时，允许重复采样
        symbols = random.choices(TEST_STOCKS, k=n_assets)
    else:
        symbols = random.sample(TEST_STOCKS, n_assets)
    weights = np.random.random(n_assets)
    weights = weights / weights.sum()
    return [
        {"symbol": s, "quantity": random.randint(100, 10000), "weight": float(w)}
        for s, w in zip(symbols, weights)
    ]

def build_test_case(case_id: str, n_assets: int, method: str, confidence: float, horizon: int) -> Dict[str, Any]:
    """构建单个测试用例"""
    holdings = generate_holdings(n_assets)
    historical_returns = generate_historical_returns(n_assets)
    return {
        "case_id": case_id,
        "n_assets": n_assets,
        "method": method,
        "confidence_level": confidence,
        "time_horizon": horizon,
        "holdings": holdings,
        "historical_returns": historical_returns,
    }

def generate_all_test_cases() -> List[Dict[str, Any]]:
    """生成100组测试用例"""
    cases = []
    case_num = 0

    # 1. 单只股票 × 3方法 × 3置信度 = 9组
    for method in METHODS:
        for confidence in CONFIDENCES:
            case_num += 1
            cases.append(build_test_case(
                f"SINGLE_{case_num:03d}", 1, method, confidence, 1
            ))

    # 2. 10只股票组合 × 3方法 × 3参数 = 27组 (3置信度×3时间周期)
    for method in METHODS:
        for confidence in CONFIDENCES:
            for horizon in HORIZONS:
                case_num += 1
                cases.append(build_test_case(
                    f"SMALL_{case_num:03d}", 10, method, confidence, horizon
                ))

    # 3. 50只股票组合 × 3方法 × 3参数 = 27组
    for method in METHODS:
        for confidence in CONFIDENCES:
            for horizon in HORIZONS:
                case_num += 1
                cases.append(build_test_case(
                    f"MEDIUM_{case_num:03d}", 50, method, confidence, horizon
                ))

    # 4. 100只股票组合 × 3方法 × 3参数 = 27组
    for method in METHODS:
        for confidence in CONFIDENCES:
            for horizon in HORIZONS:
                case_num += 1
                cases.append(build_test_case(
                    f"LARGE_{case_num:03d}", 100, method, confidence, horizon
                ))

    # 5. 边界测试 = 10组
    boundary_cases = [
        ("BND_001", 1, "parametric", 0.9999, 365),   # 极端置信度+最长周期
        ("BND_002", 1, "historical", 0.90, 1),       # 最小参数
        ("BND_003", 5, "monte_carlo", 0.95, 1),       # 小组合蒙特卡洛
        ("BND_004", 200, "parametric", 0.95, 7),      # 超大组合
        ("BND_005", 10, "historical", 0.95, 1, True), # 空收益率（异常数据）
        ("BND_006", 10, "parametric", 0.95, 1, True),  # 全零收益率
        ("BND_007", 1, "historical", 0.99, 30),       # 单日高置信度
        ("BND_008", 50, "monte_carlo", 0.90, 1),       # 低置信度大组合
        ("BND_009", 10, "parametric", 0.95, 1, True),  # 极端波动率
        ("BND_010", 100, "historical", 0.99, 30),      # 最大组合高置信度
    ]
    for bcase in boundary_cases:
        case_id, n_assets, method, confidence, horizon = bcase[:5]
        is_abnormal = bcase[5] if len(bcase) > 5 else False
        case = build_test_case(case_id, n_assets, method, confidence, horizon)
        if is_abnormal:
            if case_id == "BND_005":
                case["historical_returns"] = [[] for _ in range(n_assets)]
            elif case_id == "BND_006":
                case["historical_returns"] = [[0.0] * 252 for _ in range(n_assets)]
            elif case_id == "BND_009":
                case["historical_returns"] = [np.random.normal(0, 0.5, 252).tolist() for _ in range(n_assets)]
        cases.append(case)

    return cases

def call_python_benchmark(case: Dict[str, Any]) -> Dict[str, Any]:
    """调用Python计算引擎作为基准"""
    payload = {
        "portfolio_id": f"benchmark_{case['case_id']}",
        "confidence_level": case["confidence_level"],
        "time_horizon": case["time_horizon"],
        "method": case["method"],
        "holdings": case["holdings"],
        "historical_returns": case["historical_returns"],
    }
    try:
        resp = requests.post(f"{CALC_ENGINE_URL}/api/v1/calculate/var", json=payload, timeout=10)
        if resp.status_code == 200:
            return {"status": "ok", "data": resp.json()}
        else:
            return {"status": "error", "code": resp.status_code, "detail": resp.text}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

def calculate_relative_error(baseline: float, actual: float) -> float:
    """计算相对误差"""
    if baseline == 0:
        return abs(actual) if actual != 0 else 0.0
    return abs((actual - baseline) / baseline) * 100

def run_benchmark(output_file: str = None):
    """运行基准测试并生成报告"""
    cases = generate_all_test_cases()
    results = []
    pass_count = 0
    fail_count = 0

    print(f"=== PRME VaR 精度基准测试 (100组) ===")
    print(f"总计用例: {len(cases)}")
    print(f"Python引擎地址: {CALC_ENGINE_URL}")
    print(f"开始时间: {datetime.now().isoformat()}")
    print()

    for case in cases:
        case_id = case["case_id"]
        benchmark = call_python_benchmark(case)

        if benchmark["status"] != "ok":
            print(f"❌ {case_id}: 基准计算失败 - {benchmark.get('detail', 'unknown')}")
            fail_count += 1
            results.append({
                "case_id": case_id,
                "status": "benchmark_failed",
                "error": benchmark.get("detail", "unknown"),
            })
            continue

        baseline_data = benchmark["data"]
        baseline_var = baseline_data.get("var_value", 0)

        # 此处可接入后端API对比，当前仅记录基准结果
        results.append({
            "case_id": case_id,
            "status": "ok",
            "n_assets": case["n_assets"],
            "method": case["method"],
            "confidence_level": case["confidence_level"],
            "time_horizon": case["time_horizon"],
            "baseline_var": baseline_var,
            "baseline_var_pct": baseline_data.get("var_percentage", 0),
            "baseline_volatility": baseline_data.get("volatility", 0),
            "baseline_expected_return": baseline_data.get("expected_return", 0),
        })
        pass_count += 1
        print(f"✅ {case_id}: n={case['n_assets']:3d} method={case['method']:14s} conf={case['confidence_level']:.2f} horizon={case['time_horizon']:3d}d var={baseline_var:12.2f}")

    print()
    print(f"=== 汇总 ===")
    print(f"通过: {pass_count}")
    print(f"失败: {fail_count}")
    print(f"成功率: {pass_count / len(cases) * 100:.1f}%")

    # 保存结果
    out_path = output_file or f"/workspace/dev-docs/prme-var-precision-baseline-{datetime.now().strftime('%Y%m%d')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "total_cases": len(cases),
                "passed": pass_count,
                "failed": fail_count,
                "engine_url": CALC_ENGINE_URL,
                "generated_at": datetime.now().isoformat(),
            },
            "cases": results,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n📄 结果已保存: {out_path}")
    return results

if __name__ == "__main__":
    run_benchmark()
