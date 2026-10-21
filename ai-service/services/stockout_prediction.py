"""
Stock-Out Prediction
--------------------
Combines current inventory with recent sales velocity (and, where available,
the demand-prediction trend) to estimate how many days remain before a
product runs out, and flags a risk level with a plain-language recommendation.
"""
from services.db import query_df
from services.demand_prediction import predict_demand_for_product

RISK_HIGH_DAYS = 3
RISK_MEDIUM_DAYS = 7
VELOCITY_WINDOW_DAYS = 14


def _current_stock(product_id: int):
    df = query_df(
        "SELECT quantity, low_stock_threshold FROM inventory WHERE product_id = %s",
        (product_id,),
    )
    if df.empty:
        return None, None
    return int(df.iloc[0]["quantity"]), int(df.iloc[0]["low_stock_threshold"])


def _recent_sales_velocity(product_id: int) -> float:
    """Average units sold per day over the last VELOCITY_WINDOW_DAYS days."""
    # VELOCITY_WINDOW_DAYS is a fixed internal constant (not user input), so it's
    # safe to interpolate directly; product_id remains a bound parameter.
    sql = f"""
        SELECT COALESCE(SUM(quantity), 0) AS total_qty
        FROM sales
        WHERE product_id = %s AND created_at >= NOW() - INTERVAL '{VELOCITY_WINDOW_DAYS} days'
    """
    df = query_df(sql, (product_id,))
    total = float(df.iloc[0]["total_qty"]) if not df.empty else 0.0
    return total / VELOCITY_WINDOW_DAYS


def predict_stockout_for_product(product_id: int) -> dict:
    stock, threshold = _current_stock(product_id)
    if stock is None:
        return {"product_id": product_id, "error": "No inventory record found for this product."}

    velocity = _recent_sales_velocity(product_id)
    demand = predict_demand_for_product(product_id)

    # Prefer the trend-based daily demand when we have enough signal; otherwise
    # fall back to raw recent velocity — whichever is non-zero and more current.
    effective_daily_demand = demand["avg_daily_demand"] if demand["avg_daily_demand"] > 0 else velocity

    if effective_daily_demand <= 0:
        return {
            "product_id": product_id,
            "current_stock": stock,
            "avg_daily_sales_last_14_days": round(velocity, 2),
            "estimated_days_until_stockout": None,
            "risk_level": "LOW",
            "recommendation": "No recent sales velocity detected — monitor, but no urgent restock needed.",
        }

    days_until_stockout = round(stock / effective_daily_demand, 1)

    if days_until_stockout <= RISK_HIGH_DAYS:
        risk = "HIGH"
    elif days_until_stockout <= RISK_MEDIUM_DAYS:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    reorder_qty = demand["recommended_reorder_quantity"] if demand["recommended_reorder_quantity"] > 0 else round(
        effective_daily_demand * 14
    )

    if risk == "HIGH":
        recommendation = f"Restock urgently — recommend adding {reorder_qty} units within the next {max(1, int(days_until_stockout))} day(s)."
    elif risk == "MEDIUM":
        recommendation = f"Plan a restock soon — recommend adding {reorder_qty} units within the week."
    else:
        recommendation = "Stock levels are healthy relative to current demand."

    return {
        "product_id": product_id,
        "current_stock": stock,
        "low_stock_threshold": threshold,
        "avg_daily_sales_last_14_days": round(velocity, 2),
        "estimated_days_until_stockout": days_until_stockout,
        "risk_level": risk,
        "recommendation": recommendation,
    }


def predict_stockout_all_products() -> list:
    products = query_df("SELECT id, name FROM products WHERE is_active = TRUE ORDER BY id")
    results = []
    for _, row in products.iterrows():
        pred = predict_stockout_for_product(int(row["id"]))
        pred["product_name"] = row["name"]
        results.append(pred)
    # Show the most urgent risks first.
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    results.sort(key=lambda r: order.get(r.get("risk_level"), 3))
    return results
