"""
Smart Retail Intelligence Platform — AI Service
=================================================
A standalone FastAPI service providing:
  - Demand prediction        (/predict-demand, /predict-demand/{product_id})
  - Stock-out prediction     (/predict-stockout, /predict-stockout/{product_id})
  - Dead / slow stock        (/dead-stock)
  - Product recommendations  (/recommendations/{product_id})

Run with:  uvicorn main:app --reload --port 8000
Docs at:   http://localhost:8000/docs
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from services import demand_prediction, stockout_prediction, dead_stock, recommendations
from services.db import query_df

app = FastAPI(
    title="Smart Retail Intelligence — AI Service",
    description="Lightweight, explainable ML/heuristics for demand forecasting, stock-out risk, dead-stock detection, and product recommendations.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local demo project — safe to keep permissive
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def root():
    return {"service": "smart-retail-ai", "status": "ok"}


@app.get("/health", tags=["health"])
def health():
    try:
        query_df("SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database_connected": db_ok}


# ------------------------------------------------------------------
# 1. DEMAND PREDICTION
# ------------------------------------------------------------------
@app.get("/predict-demand", tags=["demand"])
def predict_demand_all():
    """Predicted 7-day and 30-day demand + recommended reorder qty for every active product."""
    return {"predictions": demand_prediction.predict_demand_all_products()}


@app.get("/predict-demand/{product_id}", tags=["demand"])
def predict_demand_one(product_id: int):
    result = demand_prediction.predict_demand_for_product(product_id)
    if result.get("method") == "insufficient_data" and result.get("note"):
        # Still return 200 — "no data yet" is a valid, useful answer for a new product.
        return result
    return result


# ------------------------------------------------------------------
# 2. STOCK-OUT PREDICTION
# ------------------------------------------------------------------
@app.get("/predict-stockout", tags=["stockout"])
def predict_stockout_all():
    """Days-until-stockout, risk level, and restock recommendation for every active product."""
    return {"predictions": stockout_prediction.predict_stockout_all_products()}


@app.get("/predict-stockout/{product_id}", tags=["stockout"])
def predict_stockout_one(product_id: int):
    result = stockout_prediction.predict_stockout_for_product(product_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ------------------------------------------------------------------
# 3. DEAD / SLOW STOCK
# ------------------------------------------------------------------
@app.get("/dead-stock", tags=["dead-stock"])
def dead_stock_endpoint(
    days: int = Query(None, description="Lookback window in days (default from AI service config)"),
    max_units_sold: int = Query(None, description="Max units sold in the window to still count as dead/slow"),
):
    return {"dead_stock": dead_stock.detect_dead_stock(days=days, max_units_sold=max_units_sold)}


# ------------------------------------------------------------------
# 4. RECOMMENDATIONS
# ------------------------------------------------------------------
@app.get("/recommendations/{product_id}", tags=["recommendations"])
def recommendations_endpoint(product_id: int):
    result = recommendations.get_recommendations(product_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
