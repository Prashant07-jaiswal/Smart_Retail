const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/dashboard/summary (owner only)
 * One aggregated payload covering everything the dashboard needs.
 */
const summary = asyncHandler(async (req, res) => {
  const [
    todaySalesResult,
    totalRevenueResult,
    totalOrdersResult,
    pendingOrdersResult,
    lowStockResult,
    expiringResult,
    bestSellersResult,
    slowMoversResult,
    recentOrdersResult,
    revenueTrendResult,
  ] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE created_at::date = CURRENT_DATE`),
    query(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales`),
    query(`SELECT COUNT(*) AS total FROM orders`),
    query(`SELECT COUNT(*) AS total FROM orders WHERE status = 'PENDING'`),
    query(
      `SELECT p.id, p.name, i.quantity, i.low_stock_threshold
       FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE i.quantity <= i.low_stock_threshold AND p.is_active = TRUE
       ORDER BY i.quantity ASC LIMIT 10`
    ),
    query(
      `SELECT p.id, p.name, p.expiry_date, COALESCE(i.quantity, 0) AS stock,
              (p.expiry_date < CURRENT_DATE) AS is_expired
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.is_active = TRUE
         AND p.expiry_date IS NOT NULL
         AND p.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY p.expiry_date ASC LIMIT 10`
    ),
    query(
      `SELECT p.id, p.name, SUM(s.quantity) AS units_sold, SUM(s.total_amount) AS revenue
       FROM sales s JOIN products p ON p.id = s.product_id
       WHERE s.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY p.id, p.name ORDER BY units_sold DESC LIMIT 5`
    ),
    query(
      `SELECT p.id, p.name, COALESCE(SUM(s.quantity), 0) AS units_sold, i.quantity AS current_stock
       FROM products p
       JOIN inventory i ON i.product_id = p.id
       LEFT JOIN sales s ON s.product_id = p.id AND s.created_at >= NOW() - INTERVAL '30 days'
       WHERE p.is_active = TRUE
       GROUP BY p.id, p.name, i.quantity
       HAVING COALESCE(SUM(s.quantity), 0) <= 2
       ORDER BY i.quantity DESC LIMIT 5`
    ),
    query(
      `SELECT o.id, o.status, o.total_amount, o.created_at, u.name AS customer_name
       FROM orders o JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC LIMIT 10`
    ),
    query(
      `SELECT created_at::date AS day, SUM(total_amount) AS revenue
       FROM sales
       WHERE created_at >= NOW() - INTERVAL '14 days'
       GROUP BY day ORDER BY day ASC`
    ),
  ]);

  res.json({
    todaySales: Number(todaySalesResult.rows[0].total),
    totalRevenue: Number(totalRevenueResult.rows[0].total),
    totalOrders: Number(totalOrdersResult.rows[0].total),
    pendingOrders: Number(pendingOrdersResult.rows[0].total),
    lowStock: lowStockResult.rows,
    expiringProducts: expiringResult.rows,
    bestSellers: bestSellersResult.rows,
    slowMovers: slowMoversResult.rows,
    recentOrders: recentOrdersResult.rows,
    revenueTrend: revenueTrendResult.rows,
  });
});

module.exports = { summary };
