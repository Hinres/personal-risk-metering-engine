#!/usr/bin/env python3
"""
PRME VaR 精度快速验证脚本
基于 var_precision_benchmark.py 生成用例，对比 baseline_var 与 simulate_backend_fallback 结果
"""

import json
import sys
import numpy as np

sys.path.insert(0, '/workspace/projects/personal-risk-metering-engine/calculation-engine/tests_dev')
from var_precision_benchmark import generate_all_test_cases

def simulate_backend_fallback(case):
    """复刻 var_backend_comparison.py 中的 simulate_backend_fallback"""
    holdings = case.get("holdings", [])
    historical_returns = case.get("historical_returns", [])
    confidence = case["confidence_level"]
    horizon = case["time_horizon"]

    n_assets = len(holdings)
    if n_assets == 0:
        return {"status": "error", "detail": "empty portfolio"}

    weights = np.array([h.get("weight", 1.0/n_assets) for h in holdings])
    weights = weights / weights.sum()

    n_days = len(historical_returns[0]) if historical_returns and len(historical_returns) > 0 else 0
    portfolio_mean = 0.0
    portfolio_var = 0.0

    if n_days > 0:
        for day in range(n_days):
            day_return = 0.0
            for i in range(n_assets):
                day_return += (historical_returns[i][day] if day < len(historical_returns[i]) else 0) * weights[i]
            portfolio_mean += day_return
        portfolio_mean /= n_days

        for day in range(n_days):
            day_return = 0.0
            for i in range(n_assets):
                day_return += (historical_returns[i][day] if day < len(historical_returns[i]) else 0) * weights[i]
            portfolio_var += (day_return - portfolio_mean) ** 2
        portfolio_var /= n_days

    portfolio_std = np.sqrt(portfolio_var)
    z_scores = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090, 0.9999: 3.719}
    z = z_scores.get(confidence, 1.645)

    total_value = 1_000_000
    var_value = portfolio_mean * total_value * horizon + z * portfolio_std * total_value * np.sqrt(horizon)
    return {"status": "ok", "var_value": float(var_value)}

def main():
    with open('/workspace/dev-docs/prme-var-precision-baseline-20260620.json') as f:
        baseline_data = json.load(f)
    baseline_map = {c["case_id"]: c for c in baseline_data["cases"]}

    cases = generate_all_test_cases()
    results = []
    pass_count = 0
    fail_count = 0
    skip_count = 0

    print(f"=== PRME VaR 精度验证（100组）===")
    print(f"误差阈值: 5%")
    print()

    for case in cases:
        case_id = case["case_id"]
        baseline = baseline_map.get(case_id)
        if not baseline:
            print(f"⚠️  {case_id}: 基准文件中没有对应用例")
            skip_count += 1
            continue

        backend = simulate_backend_fallback(case)
        if backend["status"] != "ok":
            print(f"⚠️  {case_id}: 计算失败 - {backend.get('detail')}")
            skip_count += 1
            continue

        baseline_var = baseline["baseline_var"]
        backend_var = backend["var_value"]

        if baseline_var == 0:
            error_pct = abs(backend_var) * 100 if backend_var != 0 else 0.0
        else:
            error_pct = abs((backend_var - baseline_var) / baseline_var) * 100

        is_pass = error_pct < 5.0
        if is_pass:
            pass_count += 1
        else:
            fail_count += 1

        symbol = "✅" if is_pass else "❌"
        print(f"{symbol} {case_id}: n={case['n_assets']:3d} method={case['method']:14s} "
              f"baseline={baseline_var:12.4f} backend={backend_var:12.4f} error={error_pct:6.2f}%")

        results.append({
            "case_id": case_id,
            "status": "pass" if is_pass else "fail",
            "baseline_var": baseline_var,
            "backend_var": backend_var,
            "error_pct": round(error_pct, 4),
        })

    print()
    print(f"=== 汇总 ===")
    print(f"通过: {pass_count}")
    print(f"失败: {fail_count}")
    print(f"跳过: {skip_count}")
    evaluated = pass_count + fail_count
    if evaluated > 0:
        print(f"通过率: {pass_count / evaluated * 100:.1f}%")

    out_path = "/workspace/dev-docs/prme-var-precision-verification-20260628.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {"threshold_pct": 5.0, "total": len(cases),
                         "passed": pass_count, "failed": fail_count, "skipped": skip_count},
            "cases": results,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n📄 结果已保存: {out_path}")

if __name__ == "__main__":
    main()
