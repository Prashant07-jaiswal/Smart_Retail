"""
Dead / Slow Stock Detection
---------------------------
Flags products that have sold very little (or not at all) in a configurable
recent window while still holding a large amount of inventory — a simple,
explainable rule-based approach rather than a black-box model, since the
recommendation ("discount", "bundle", "stop reordering") needs to be
justifiable to a store owner.
"""
import os
import pandas as pd
from services.db import query_df

DEAD_STOCK_DAYS = int(os.getenv("DEAD_STOCK_DAYS_THRESHOLD", 14))
DEAD_STOCK_MAX_UNITS_SOLD = int(os.getenv("DEAD_STOCK_MAX_UNITS_SOLD", 3))


def detect_dead_stock(days: int = None, max_units_sold: int = None) -> list:
    days = days or DEAD_STOCK_DAYS
    max_units_sold = max_units_sold if max_units_sold is not None else DEAD_STOCK_MAX_UNITS_SOLD

    sql = f"""
        SELECT
            p.id, p.name, p.price, i.quantity AS current_stock,
            COALESCE(SUM(s.quantity), 0) AS units_sold_recently,
            MAX(s.created_at) AS last_sale_at
        FROM products p
        JOIN inventory i ON i.product_id = p.id
        LEFT JOIN sales s
            ON s.product_id = p.id AND s.created_at >= NOW() - INTERVAL '{days} days'
        WHERE p.is_active = TRUE
        GROUP BY p.id, p.name, p.price, i.quantity
        HAVING COALESCE(SUM(s.quantity), 0) <= %s AND i.quantity > 0
        ORDER BY i.quantity DESC
    """
    df = query_df(sql, (max_units_sold,))

    results = []
    for _, row in df.iterrows():
        stock = int(row["current_stock"])
        sold = int(row["units_sold_recently"])

        if sold == 0:
            recommendation = "Stop reordering and consider a clearance discount — no sales in the window at all."
        elif stock > 100:
            recommendation = "Bundle with a fast-selling product or run a discount to clear excess inventory."
        else:
            recommendation = "Offer a small discount to boost turnover; hold off on reordering for now."

        results.append(
            {
                "product_id": int(row["id"]),
                "product_name": row["name"],
                "price": float(row["price"]),
                "current_stock": stock,
                "units_sold_last_%d_days" % days: sold,
                "last_sale_at": None if pd.isna(row["last_sale_at"]) else row["last_sale_at"].isoformat(),
                "recommendation": recommendation,
            }
        )
    return results
