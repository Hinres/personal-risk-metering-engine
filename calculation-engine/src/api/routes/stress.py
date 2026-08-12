from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from src.stress.scenarios import get_scenarios, get_scenario

router = APIRouter()

# Sector / industry 到冲击因子的映射表
# 基于A股行业分类和情景中定义的因子名称对齐
SECTOR_SHOCK_MAP = {
    # 金融
    "银行": "financial_sector",
    "保险": "financial_sector",
    "证券": "financial_sector",
    "金融": "financial_sector",
    # 科技
    "科技": "tech_sector",
    "计算机": "tech_sector",
    "电子": "tech_sector",
    "通信": "tech_sector",
    "互联网": "tech_sector",
    # 消费
    "消费": "consumer_staples",
    "食品饮料": "consumer_staples",
    "医药": "consumer_staples",
    # 能源
    "能源": "energy",
    "石油": "energy",
    "煤炭": "energy",
    # 材料
    "材料": "materials",
    "化工": "materials",
    "钢铁": "materials",
    # 工业/制造
    "工业": "global_equity",
    "制造": "global_equity",
    "汽车": "global_equity",
    # 房地产
    "房地产": "real_estate",
    # 农业
    "农业": "agriculture",
    # 休闲/旅游
    "旅游": "travel_leisure",
    "休闲": "travel_leisure",
    # 军工
    "军工": "defense",
    # 默认映射
    "default": "global_equity",
}


class HoldingItem(BaseModel):
    symbol: str
    quantity: float
    current_price: float
    sector: Optional[str] = None
    industry: Optional[str] = None
    weight: Optional[float] = None


class StressTestRequest(BaseModel):
    portfolio_id: str
    scenario_id: str
    holdings: List[HoldingItem]


class CustomScenarioRequest(BaseModel):
    portfolio_id: str
    scenario_name: str
    shocks: Dict[str, float]
    holdings: List[HoldingItem]


def map_sector_to_shock_key(sector: Optional[str], industry: Optional[str]) -> str:
    """将持仓的sector/industry映射到情景冲击因子名称"""
    if not sector and not industry:
        return "default"
    # 优先匹配industry，其次sector
    for label in [industry, sector]:
        if label:
            label = label.strip()
            if label in SECTOR_SHOCK_MAP:
                return SECTOR_SHOCK_MAP[label]
    return "default"


def calculate_stressed_portfolio(
    holdings: List[HoldingItem],
    shocks: Dict[str, float],
) -> Dict:
    """根据冲击因子计算组合受压后的价值和各资产结果"""
    total_value = 0.0
    stressed_value = 0.0
    asset_results = []

    for h in holdings:
        market_value = h.quantity * (h.current_price or 0)
        shock_key = map_sector_to_shock_key(h.sector, h.industry)
        # 如果该sector没有对应冲击，回退到global_equity
        shock_rate = shocks.get(shock_key, shocks.get("global_equity", 0))
        stressed_asset_value = market_value * (1 + shock_rate)
        loss = market_value - stressed_asset_value

        total_value += market_value
        stressed_value += stressed_asset_value

        asset_results.append({
            "symbol": h.symbol,
            "sector": h.sector,
            "industry": h.industry,
            "market_value": round(market_value, 2),
            "shock_key": shock_key,
            "shock_rate": round(shock_rate, 4),
            "stressed_value": round(stressed_asset_value, 2),
            "loss": round(loss, 2),
            "loss_percentage": round(abs(shock_rate) * 100, 2),
        })

    loss_amount = total_value - stressed_value
    loss_percentage = (loss_amount / total_value * 100) if total_value > 0 else 0

    return {
        "portfolio_value": round(total_value, 2),
        "stressed_value": round(stressed_value, 2),
        "loss_amount": round(loss_amount, 2),
        "loss_percentage": round(loss_percentage, 2),
        "asset_results": asset_results,
        "shocks_applied": shocks,
    }


@router.get("/stress/scenarios")
async def list_scenarios():
    """Get all available stress test scenarios."""
    scenarios = get_scenarios()
    return {
        "scenarios": [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in scenarios.items()
        ],
        "total": len(scenarios),
    }


@router.post("/stress/test")
async def run_stress_test(request: StressTestRequest):
    """Run a stress test for a portfolio using a predefined scenario."""
    scenario = get_scenario(request.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if not request.holdings:
        raise HTTPException(status_code=400, detail="Portfolio holdings are required")

    shocks = scenario["shocks"]
    result = calculate_stressed_portfolio(request.holdings, shocks)

    return {
        "portfolio_id": request.portfolio_id,
        "scenario_id": request.scenario_id,
        "scenario_name": scenario["name"],
        "scenario_type": "historical",
        **result,
    }


@router.post("/stress/custom")
async def run_custom_stress_test(request: CustomScenarioRequest):
    """Run a stress test with user-defined shocks."""
    if not request.holdings:
        raise HTTPException(status_code=400, detail="Portfolio holdings are required")
    if not request.shocks:
        raise HTTPException(status_code=400, detail="Custom shocks are required")

    result = calculate_stressed_portfolio(request.holdings, request.shocks)

    return {
        "portfolio_id": request.portfolio_id,
        "scenario_id": "custom",
        "scenario_name": request.scenario_name,
        "scenario_type": "custom",
        **result,
    }
