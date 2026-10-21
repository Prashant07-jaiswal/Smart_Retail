const { query, getClient } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'];

/**
 * POST /api/sales (owner only) — completes a POS bill.
 * body: { items: [{ product_id, quantity }], payment_method }
 * Deducts inventory immediately (a POS sale is instantaneous, unlike a customer order).
 */
const createSale = asyncHandler(async (req, res) => {
  const { items, payment_method } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Sale must contain at least one item.');
  }
  if (!PAYMENT_METHODS.includes(payment_method)) {
    throw new ApiError(400, `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const receiptNo = `RCPT-${Date.now()}`;
    const saleRecords = [];
    let grandTotal = 0;

    for (const { product_id, quantity } of items) {
      if (!product_id || !Number.isInteger(quantity) || quantity <= 0) {
        throw new ApiError(400, 'Each item needs a valid product_id and a positive integer quantity.');
      }

      const productResult = await client.query('SELECT * FROM products WHERE id = $1', [product_id]);
      if (productResult.rows.length === 0) throw new ApiError(404, `Product ${product_id} not found.`);
      const product = productResult.rows[0];
      if (product.expiry_date && new Date(product.expiry_date) < new Date(new Date().toDateString())) {
        throw new ApiError(400, `"${product.name}" has expired and cannot be sold. Remove it from stock instead.`);
      }

      const invResult = await client.query('SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE', [product_id]);
      const inv = invResult.rows[0];
      if (!inv || inv.quantity < quantity) {
        throw new ApiError(400, `Insufficient stock for "${product.name}". Available: ${inv ? inv.quantity : 0}.`);
      }

      const lineTotal = Number(product.price) * quantity;
      grandTotal += lineTotal;

      await client.query(
        'UPDATE inventory SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2',
        [quantity, product_id]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_change, movement_type, reference)
         VALUES ($1, $2, 'SALE', $3)`,
        [product_id, -quantity, receiptNo]
      );

      const saleResult = await client.query(
        `INSERT INTO sales (product_id, quantity, total_amount, payment_method, receipt_no)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [product_id, quantity, lineTotal.toFixed(2), payment_method, receiptNo]
      );
      saleRecords.push({ ...saleResult.rows[0], product_name: product.name });
    }

    await client.query('COMMIT');

    res.status(201).json({
      receipt: {
        receipt_no: receiptNo,
        items: saleRecords,
        grand_total: grandTotal.toFixed(2),
        payment_method,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * GET /api/sales (owner only) — recent sales, optional ?limit=
 */
const listSales = asyncHandler(async (req, res) => {
  const { limit = 100 } = req.query;
  const result = await query(
    `SELECT s.*, p.name AS product_name
     FROM sales s JOIN products p ON p.id = s.product_id
     ORDER BY s.created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ sales: result.rows });
});

/** Escapes a value for safe inclusion in a CSV cell. */
function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/sales/export (owner only) — downloadable CSV transaction statement.
 * Covers every completed transaction — both POS sales and completed customer
 * orders — since both write into the same `sales` table. Optional ?from= and
 * ?to= (YYYY-MM-DD) narrow the date range; defaults to the last 30 days.
 */
const exportSalesCsv = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const conditions = [];
  const params = [];
  if (from) {
    params.push(from);
    conditions.push(`s.created_at >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`s.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (!from && !to) {
    conditions.push(`s.created_at >= NOW() - INTERVAL '30 days'`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.id, s.created_at, s.receipt_no, p.name AS product_name, s.quantity,
            s.total_amount, s.payment_method
     FROM sales s JOIN products p ON p.id = s.product_id
     ${whereClause}
     ORDER BY s.created_at ASC`,
    params
  );

  const header = ['Date', 'Receipt No', 'Product', 'Quantity', 'Amount (INR)', 'Payment Method'];
  const rows = result.rows.map((r) => [
    new Date(r.created_at).toISOString(),
    r.receipt_no,
    r.product_name,
    r.quantity,
    r.total_amount,
    r.payment_method,
  ]);
  const grandTotal = result.rows.reduce((sum, r) => sum + Number(r.total_amount), 0);

  const lines = [header, ...rows, [], ['', '', '', 'TOTAL', grandTotal.toFixed(2), '']];
  const csv = lines.map((line) => line.map(csvCell).join(',')).join('\r\n');

  const rangeLabel = from || to ? `${from || 'start'}_to_${to || 'now'}` : 'last-30-days';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sales-statement-${rangeLabel}.csv"`);
  res.send(csv);
});

module.exports = { createSale, listSales, exportSalesCsv };
