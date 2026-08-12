#!/usr/bin/env python3
"""
PRME VaR 计算引擎精度验证
验证 Python 引擎各方法的计算正确性
"""

import numpy as np
import requests
import json

CALC_ENGINE = "http://localhost:8000/api/v1"

def test_parametric_accuracy():
    """验证参数法：使用已知统计特性的数据，检查 VaR 是否符合正态分布公式"""
    np.random.seed(42)
    
    # 构造简单场景：单资产，已知均值和标准差
    mean_return = 0.001
    std_return = 0.02
    n_days = 252
    returns = np.random.normal(mean_return, std_return, n_days).tolist()
    
    # 理论 VaR (parametric): μ - z * σ
    # 95% 置信度: z = 1.645
    # 1天期: VaR = -(μ - z*σ) = z*σ - μ (假设 μ 很小)
    z_95 = 1.645
    expected_var_pct = z_95 * std_return - mean_return  # ~ 0.0319 (3.19%)
    
    res = requests.post(f"{CALC_ENGINE}/calculate/var", json={
        "portfolio_id": "test_parametric",
        "holdings": [{"symbol": "TEST", "weight": 1.0, "quantity": 100}],
        "confidence_level": 0.95,
        "time_horizon": 1,
        "method": "parametric",
        "historical_returns": [returns]
    }, timeout=30)
    
    if res.status_code != 200:
        print(f"❌ 参数法请求失败: {res.status_code}")
        return False
    
    data = res.json()
    actual_var_pct = abs(data.get("var_value", 0))
    error_pct = abs((actual_var_pct - expected_var_pct) / expected_var_pct) * 100 if expected_var_pct > 0 else 0
    
    print(f"参数法验证:")
    print(f"  理论 VaR: {expected_var_pct:.6f} ({expected_var_pct*100:.2f}%)")
    print(f"  实际 VaR: {actual_var_pct:.6f} ({actual_var_pct*100:.2f}%)")
    print(f"  误差: {error_pct:.2f}%")
    print(f"  状态: {'✅ 通过' if error_pct < 5 else '❌ 失败'}")
    return error_pct < 5

def test_historical_vs_parametric():
    """对比历史模拟法和参数法：对于正态分布数据，两者应接近"""
    np.random.seed(123)
    
    returns = np.random.normal(0.001, 0.02, 252).tolist()
    
    results = {}
    for method in ["parametric", "historical"]:
        res = requests.post(f"{CALC_ENGINE}/calculate/var", json={
            "portfolio_id": "test_compare",
            "holdings": [{"symbol": "TEST", "weight": 1.0, "quantity": 100}],
            "confidence_level": 0.95,
            "time_horizon": 1,
            "method": method,
            "historical_returns": [returns]
        }, timeout=30)
        
        if res.status_code != 200:
            print(f"❌ {method} 请求失败: {res.status_code}")
            return False
        
        results[method] = abs(res.json().get("var_value", 0))
    
    parametric_var = results["parametric"]
    historical_var = results["historical"]
    
    if parametric_var == 0:
        error_pct = 100
    else:
        error_pct = abs((historical_var - parametric_var) / parametric_var) * 100
    
    print(f"\n历史模拟法 vs 参数法对比:")
    print(f"  参数法 VaR: {parametric_var:.6f} ({parametric_var*100:.2f}%)")
    print(f"  历史模拟法 VaR: {historical_var:.6f} ({historical_var*100:.2f}%)")
    print(f"  差异: {error_pct:.2f}%")
    print(f"  状态: {'✅ 通过' if error_pct < 15 else '⚠️ 偏差较大'} (阈值: 15%)")
    return error_pct < 15

def test_multi_asset_diversification():
    """验证多资产组合的分散化效应：两资产负相关时，组合 VaR 应小于简单加权平均"""
    np.random.seed(456)
    
    # 构造负相关的两资产
    n_days = 252
    asset1 = np.random.normal(0.001, 0.02, n_days)
    asset2 = -asset1 + np.random.normal(0.001, 0.005, n_days)  # 负相关
    
    # 单独计算每个资产的 VaR
    single_var_results = []
    for i, returns in enumerate([asset1, asset2], 1):
        res = requests.post(f"{CALC_ENGINE}/calculate/var", json={
            "portfolio_id": f"test_asset_{i}",
            "holdings": [{"symbol": f"A{i}", "weight": 1.0, "quantity": 100}],
            "confidence_level": 0.95,
            "time_horizon": 1,
            "method": "parametric",
            "historical_returns": [returns.tolist()]
        }, timeout=30)
        single_var_results.append(abs(res.json().get("var_value", 0)) if res.status_code == 200 else 0)
    
    # 组合计算（等权重）
    res = requests.post(f"{CALC_ENGINE}/calculate/var", json={
        "portfolio_id": "test_portfolio",
        "holdings": [
            {"symbol": "A1", "weight": 0.5, "quantity": 100},
            {"symbol": "A2", "weight": 0.5, "quantity": 100}
        ],
        "confidence_level": 0.95,
        "time_horizon": 1,
        "method": "parametric",
        "historical_returns": [asset1.tolist(), asset2.tolist()]
    }, timeout=30)
    
    portfolio_var = abs(res.json().get("var_value", 0)) if res.status_code == 200 else 0
    weighted_avg_var = 0.5 * sum(single_var_results)
    
    diversification_benefit = weighted_avg_var - portfolio_var
    
    print(f"\n多资产分散化效应验证:")
    print(f"  资产1 VaR: {single_var_results[0]:.6f}")
    print(f"  资产2 VaR: {single_var_results[1]:.6f}")
    print(f"  加权平均 VaR: {weighted_avg_var:.6f}")
    print(f"  组合 VaR: {portfolio_var:.6f}")
    print(f"  分散化收益: {diversification_benefit:.6f}")
    print(f"  状态: {'✅ 通过' if diversification_benefit > 0 else '❌ 失败'} (组合VaR应小于加权平均)")
    return diversification_benefit > 0

def main():
    print("=" * 60)
    print("PRME VaR 计算引擎精度验证")
    print("=" * 60)
    
    # 检查引擎是否可用
    try:
        health = requests.get(f"{CALC_ENGINE}/health", timeout=5)
        if health.status_code != 200:
            print(f"❌ 计算引擎不可用: {health.status_code}")
            return
    except Exception as e:
        print(f"❌ 无法连接计算引擎: {e}")
        return
    
    print("✅ 计算引擎连接正常\n")
    
    results = []
    results.append(("参数法精度验证", test_parametric_accuracy()))
    results.append(("历史模拟法 vs 参数法对比", test_historical_vs_parametric()))
    results.append(("多资产分散化效应", test_multi_asset_diversification()))
    
    print("\n" + "=" * 60)
    print("验证汇总")
    print("=" * 60)
    for name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{status} {name}")
    
    passed_count = sum(1 for _, p in results if p)
    print(f"\n总计: {passed_count}/{len(results)} 项通过")

if __name__ == "__main__":
    main()
