import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import var, stress, risk, health, valuation, optimization

app = FastAPI(
    title="PIAP - Calculation Engine",
    description="Valuation, VaR, stress testing, and risk analysis API",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(valuation.router, prefix="/api/v1", tags=["valuation"])
app.include_router(var.router, prefix="/api/v1", tags=["var"])
app.include_router(stress.router, prefix="/api/v1", tags=["stress"])
app.include_router(risk.router, prefix="/api/v1", tags=["risk"])
app.include_router(optimization.router, prefix="/api/v1", tags=["optimization"])

@app.get("/")
async def root():
    return {"message": "PIAP Calculation Engine", "version": "1.1.0", "status": "operational"}
