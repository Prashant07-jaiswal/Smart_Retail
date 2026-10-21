"""
Demand Prediction
------------------
For a student-project / limited-demo-data setting, a simple, explainable
model beats an over-engineered one. We aggregate each product's daily unit
sales, fit a plain linear regression (trend line) against day-index using
scikit-learn, and use it to project demand for the next 7 and 30 days.

If a product has too little sales history for a trend line to mean anything
(fewer than 5 distinct sale-days), we fall back to a simple moving average,
which is more robust with sparse data.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from services.db import query_df

MIN_DAYS_FOR_REGRESSION = 5


def _daily_sales_for_product(product_id: int) -> pd.DataFrame:
    sql = """
        SELECT created_at::date AS day, SUM(quantity) AS qty
        FROM sales
        WHERE product_id = %s
        GROUP BY day
        ORDER BY day ASC
    """
    return query_df(sql, (product_id,))


def predict_demand_for_product(product_id: int) -> dict:
    df = _daily_sales_for_product(product_id)

    if df.empty:
        return {
            "product_id": product_id,
            "method": "insufficient_data",
            "avg_daily_demand": 0,
            "predicted_demand_7_days": 0,
            "predicted_demand_30_days": 0,
            "recommended_reorder_quantity": 0,
            "note": "No historical sales found for this product yet.",
        }

    # Fill in missing days with 0 sales so the trend reflects real gaps too.
    full_range = pd.date_range(df["day"].min(), df["day"].max(), freq="D")
    df = df.set_index("day").reindex(full_range, fill_value=0).rename_axis("day").reset_index()
    df["day_index"] = np.arange(len(df))

    if len(df) >= MIN_DAYS_FOR_REGRESSION and df["qty"].sum() > 0:
        X = df[["day_index"]].values
        y = df["qty"].values
        model = LinearRegression()
        model.fit(X, y)

        future_indices = np.arange(len(df), len(df) + 30).reshape(-1, 1)
        predictions = model.predict(future_indices)
        predictions = np.clip(predictions, a_min=0, a_max=None)  # demand can't be negative

        demand_7 = float(np.sum(predictions[:7]))
        demand_30 = float(np.sum(predictions[:30]))
        avg_daily = float(np.mean(predictions[:7]))
        method = "linear_regression_trend"
    else:
        # Fallback: simple moving average over whatever history exists.
        avg_daily = float(df["qty"].mean())
        demand_7 = avg_daily * 7
        demand_30 = avg_daily * 30
        method = "moving_average"

    # Recommended reorder = enough to cover 30 days of predicted demand,
    # with a 20% safety buffer (a simple, explainable heuristic).
    recommended_reorder = round(demand_30 * 1.2)

    return {
        "product_id": product_id,
        "method": method,
        "avg_daily_demand": round(avg_daily, 2),
        "predicted_demand_7_days": round(demand_7),
        "predicted_demand_30_days": round(demand_30),
        "recommended_reorder_quantity": int(recommended_reorder),
    }


def predict_demand_all_products() -> list:
    products = query_df("SELECT id, name FROM products WHERE is_active = TRUE ORDER BY id")
    results = []
    for _, row in products.iterrows():
        pred = predict_demand_for_product(int(row["id"]))
        pred["product_name"] = row["name"]
        results.append(pred)
    return results
