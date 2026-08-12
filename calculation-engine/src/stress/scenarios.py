STRESS_SCENARIOS = {
    "2008_financial_crisis": {
        "name": "2008年金融危机",
        "description": "雷曼兄弟破产引发的全球金融危机",
        "shocks": {
            "global_equity": -0.40,
            "financial_sector": -0.60,
            "credit_spreads": 0.05,
            "volatility": 0.80
        }
    },
    "2020_covid_pandemic": {
        "name": "2020年新冠疫情冲击",
        "description": "COVID-19全球大流行导致的市场崩盘",
        "shocks": {
            "global_equity": -0.35,
            "travel_leisure": -0.70,
            "oil": -0.50,
            "tech": 0.10
        }
    },
    "2015_a_share_crash": {
        "name": "2015年A股股灾",
        "description": "中国股市剧烈波动，融资盘踩踏",
        "shocks": {
            "china_equity": -0.30,
            "small_cap": -0.45,
            "margin_stocks": -0.50
        }
    },
    "trade_war": {
        "name": "贸易战升级",
        "description": "中美贸易摩擦加剧，关税壁垒升级",
        "shocks": {
            "global_equity": -0.20,
            "tech_sector": -0.30,
            "emerging_markets": -0.25,
            "agriculture": -0.15
        }
    },
    "inflation_shock": {
        "name": "通胀失控",
        "description": "通胀率飙升导致央行激进加息",
        "shocks": {
            "interest_rates": 0.03,
            "bonds": -0.15,
            "growth_stocks": -0.25,
            "value_stocks": -0.05
        }
    },
    "2022_russia_ukraine": {
        "name": "2022年俄乌冲突",
        "description": "地缘政治冲突导致能源和粮食危机",
        "shocks": {
            "global_equity": -0.15,
            "energy": 0.60,
            "agriculture": 0.40,
            "defense": 0.30,
            "europe_equity": -0.25
        }
    },
    "dotcom_bubble": {
        "name": "科技泡沫破裂",
        "description": "互联网泡沫破裂，科技股集体暴跌",
        "shocks": {
            "tech_sector": -0.70,
            "nasdaq": -0.65,
            "growth_stocks": -0.50,
            "global_equity": -0.25
        }
    },
    "sovereign_debt_crisis": {
        "name": "主权债务危机",
        "description": "多国主权债务违约引发金融市场动荡",
        "shocks": {
            "bonds": -0.30,
            "financial_sector": -0.35,
            "emerging_markets": -0.40,
            "credit_spreads": 0.08,
            "global_equity": -0.20
        }
    },
    "rate_shock": {
        "name": "利率急升",
        "description": "央行超预期加息导致资产价格重估",
        "shocks": {
            "interest_rates": 0.05,
            "growth_stocks": -0.35,
            "real_estate": -0.30,
            "bonds": -0.20,
            "value_stocks": -0.10
        }
    },
    "liquidity_crisis": {
        "name": "流动性危机",
        "description": "银行间流动性枯竭，信贷紧缩",
        "shocks": {
            "global_equity": -0.30,
            "credit_spreads": 0.10,
            "small_cap": -0.45,
            "emerging_markets": -0.35,
            "bonds": -0.15
        }
    },
    "commodity_surge": {
        "name": "大宗商品暴涨",
        "description": "大宗商品价格飙升，通胀压力传导",
        "shocks": {
            "commodities": 0.50,
            "energy": 0.40,
            "materials": 0.35,
            "global_equity": -0.15,
            "consumer_staples": -0.10
        }
    }
}

def get_scenarios():
    return STRESS_SCENARIOS

def get_scenario(scenario_id: str):
    return STRESS_SCENARIOS.get(scenario_id)
