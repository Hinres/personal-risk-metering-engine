from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from src.valuation.fundamental import (
    calculate_pe_valuation,
    calculate_pb_valuation,
    calculate_dcf_valuation,
    calculate_ddm_valuation,
    calculate_peg_valuation,
)

router = APIRouter()


class PEValuationRequest(BaseModel):
    eps: float = Field(..., gt=0, description="每股收益")
    pe_ratio_industry: float = Field(..., gt=0, description="行业平均PE")
    pe_ratio_historical: Optional[float] = Field(None, gt=0, description="历史平均PE")
    growth_rate: Optional[float] = Field(None, description="预期增长率 (如 0.15 表示15%)")
    risk_free_rate: float = Field(0.03, ge=0, description="无风险利率")
    method: str = Field("all", description="估值方法: industry | historical | growth | all")


class PBValuationRequest(BaseModel):
    book_value_per_share: float = Field(..., gt=0, description="每股净资产")
    pb_ratio_industry: float = Field(..., gt=0, description="行业平均PB")
    pb_ratio_historical: Optional[float] = Field(None, gt=0, description="历史平均PB")
    roe: Optional[float] = Field(None, description="ROE (如 0.15 表示15%)")
    method: str = Field("all", description="估值方法: industry | historical | roe | all")


class DCFValuationRequest(BaseModel):
    free_cash_flow: float = Field(..., gt=0, description="基准年自由现金流")
    growth_rates: List[float] = Field(..., min_length=1, description="预测期增长率列表")
    terminal_growth_rate: float = Field(..., gt=0, lt=0.10, description="永续增长率")
    discount_rate: float = Field(0.10, gt=0, lt=0.30, description="折现率(WACC)")
    shares_outstanding: float = Field(1.0, gt=0, description="总股本")
    net_debt: float = Field(0.0, description="净债务")


class DDMValuationRequest(BaseModel):
    dividend_per_share: float = Field(..., gt=0, description="每股股息")
    growth_rate: float = Field(..., gt=0, description="永续增长率")
    discount_rate: float = Field(0.10, gt=0, lt=0.30, description="必要回报率")
    multi_stage: Optional[List[float]] = Field(None, description="多阶段增长率(可选)")


class PEGValuationRequest(BaseModel):
    eps: float = Field(..., gt=0, description="每股收益")
    pe_ratio: float = Field(..., gt=0, description="当前PE")
    growth_rate: float = Field(..., gt=0, description="预期增长率")
    peg_target: float = Field(1.0, gt=0, description="目标PEG(默认1.0)")


@router.post("/valuation/pe")
async def pe_valuation(request: PEValuationRequest):
    """PE市盈率估值"""
    result = calculate_pe_valuation(
        eps=request.eps,
        pe_ratio_industry=request.pe_ratio_industry,
        pe_ratio_historical=request.pe_ratio_historical,
        growth_rate=request.growth_rate,
        risk_free_rate=request.risk_free_rate,
        method=request.method,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"method": "pe", **result}


@router.post("/valuation/pb")
async def pb_valuation(request: PBValuationRequest):
    """PB市净率估值"""
    result = calculate_pb_valuation(
        book_value_per_share=request.book_value_per_share,
        pb_ratio_industry=request.pb_ratio_industry,
        pb_ratio_historical=request.pb_ratio_historical,
        roe=request.roe,
        method=request.method,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"method": "pb", **result}


@router.post("/valuation/dcf")
async def dcf_valuation(request: DCFValuationRequest):
    """DCF现金流折现估值"""
    result = calculate_dcf_valuation(
        free_cash_flow=request.free_cash_flow,
        growth_rates=request.growth_rates,
        terminal_growth_rate=request.terminal_growth_rate,
        discount_rate=request.discount_rate,
        shares_outstanding=request.shares_outstanding,
        net_debt=request.net_debt,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"method": "dcf", **result}


@router.post("/valuation/ddm")
async def ddm_valuation(request: DDMValuationRequest):
    """DDM股息贴现估值"""
    result = calculate_ddm_valuation(
        dividend_per_share=request.dividend_per_share,
        growth_rate=request.growth_rate,
        discount_rate=request.discount_rate,
        multi_stage=request.multi_stage,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"method": "ddm", **result}


@router.post("/valuation/peg")
async def peg_valuation(request: PEGValuationRequest):
    """PEG市盈增长比率估值"""
    result = calculate_peg_valuation(
        eps=request.eps,
        pe_ratio=request.pe_ratio,
        growth_rate=request.growth_rate,
        peg_target=request.peg_target,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"method": "peg", **result}


@router.get("/valuation/methods")
async def list_valuation_methods():
    """列出支持的估值方法"""
    return {
        "methods": [
            {"id": "pe", "name": "PE市盈率估值", "description": "基于每股收益和行业/历史PE的相对估值"},
            {"id": "pb", "name": "PB市净率估值", "description": "基于每股净资产和行业/历史PB的相对估值"},
            {"id": "dcf", "name": "DCF现金流折现", "description": "基于未来自由现金流折现的绝对估值"},
            {"id": "ddm", "name": "DDM股息贴现", "description": "基于未来股息折现的绝对估值"},
            {"id": "peg", "name": "PEG估值", "description": "基于PE与增长率的相对估值"},
        ]
    }
