from pydantic import BaseModel
from typing import List, Optional

class HoldingInput(BaseModel):
    symbol: str
    quantity: float
    weight: Optional[float] = None

class VaRRequest(BaseModel):
    portfolio_id: str
    confidence_level: float = 0.95
    time_horizon: int = 1
    method: str = "historical"
    holdings: List[HoldingInput]
    historical_returns: Optional[List[List[float]]] = None  # 历史收益率数据，每行是一个时间点的各资产收益率

class VaRResponse(BaseModel):
    var_value: float
    var_percentage: Optional[float]
    expected_return: Optional[float]
    volatility: Optional[float]
    components: List[dict]
    risk_factors: List[dict]
    method: str
    confidence_level: float
