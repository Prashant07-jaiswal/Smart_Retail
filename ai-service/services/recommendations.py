"""
Product Recommendations
------------------------
Deliberately simple and explainable, per the project spec:

1. "Frequently bought together" — co-occurrence mined from order_items:
   which products most often appear in the same order as the target product.
2. "Similar products" — same category, closest price to the target product.
3. "Alternative products" — same category, different product, any price,
   ranked by recent sales popularity (so alternatives are actually in stock
   and proven sellers).

No black-box ML is used here; every recommendation can be explained in one
sentence, which matters more than model sophistication for a retail owner.
"""
from services.db import query_df


def _get_product(product_id: int):
    df = query_df(
        """
        SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name
        FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = %s AND p.is_active = TRUE
        """,
        (product_id,),
    )
    return None if df.empty else df.iloc[0]


def _frequently_bought_together(product_id: int, limit: int = 5):
    sql = """
        SELECT oi2.product_id, p.name, COUNT(*) AS times_bought_together
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id != oi2.product_id
        JOIN products p ON p.id = oi2.product_id
        WHERE oi1.product_id = %s AND p.is_active = TRUE
        GROUP BY oi2.product_id, p.name
        ORDER BY times_bought_together DESC
        LIMIT %s
    """
    df = query_df(sql, (product_id, limit))
    return [
        {
            "product_id": int(r["product_id"]),
            "product_name": r["name"],
            "times_bought_together": int(r["times_bought_together"]),
            "reason": "Frequently bought together with this product.",
        }
        for _, r in df.iterrows()
    ]


def _similar_products(product_id: int, category_id, price, limit: int = 5):
    if category_id is None:
        return []
    sql = """
        SELECT p.id, p.name, p.price, COALESCE(i.quantity, 0) AS stock
        FROM products p LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.category_id = %s AND p.id != %s AND p.is_active = TRUE
        ORDER BY ABS(p.price - %s) ASC
        LIMIT %s
    """
    df = query_df(sql, (int(category_id), product_id, float(price), limit))
    return [
        {
            "product_id": int(r["id"]),
            "product_name": r["name"],
            "price": float(r["price"]),
            "in_stock": int(r["stock"]) > 0,
            "reason": "Same category, similar price point.",
        }
        for _, r in df.iterrows()
    ]


def _alternative_products(product_id: int, category_id, limit: int = 5):
    if category_id is None:
        return []
    sql = """
        SELECT p.id, p.name, p.price, COALESCE(i.quantity, 0) AS stock,
               COALESCE(SUM(s.quantity), 0) AS recent_sales
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN sales s ON s.product_id = p.id AND s.created_at >= NOW() - INTERVAL '30 days'
        WHERE p.category_id = %s AND p.id != %s AND p.is_active = TRUE
        GROUP BY p.id, p.name, p.price, i.quantity
        ORDER BY recent_sales DESC
        LIMIT %s
    """
    df = query_df(sql, (int(category_id), product_id, limit))
    return [
        {
            "product_id": int(r["id"]),
            "product_name": r["name"],
            "price": float(r["price"]),
            "in_stock": int(r["stock"]) > 0,
            "reason": "Popular alternative in the same category.",
        }
        for _, r in df.iterrows()
    ]


def get_recommendations(product_id: int) -> dict:
    product = _get_product(product_id)
    if product is None:
        return {"error": "Product not found or inactive."}

    return {
        "product_id": product_id,
        "product_name": product["name"],
        "frequently_bought_together": _frequently_bought_together(product_id),
        "similar_products": _similar_products(product_id, product["category_id"], product["price"]),
        "alternative_products": _alternative_products(product_id, product["category_id"]),
    }
