const { query, getClient } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * GET /api/inventory (owner only)
 * Full inventory view with low-stock flag.
 */
const listInventory = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT i.*, p.name AS product_name, p.barcode, p.price,
            (i.quantity <= i.low_stock_threshold) AS is_low_stock
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE p.is_active = TRUE
     ORDER BY is_low_stock DESC, p.name ASC`
  );
  res.json({ inventory: result.rows });
});

/**
 * GET /api/inventory/low-stock (owner only)
 */
const lowStock = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT i.*, p.name AS product_name, p.barcode
     FROM inventory i JOIN products p ON p.id = i.product_id
     WHERE i.quantity <= i.low_stock_threshold AND p.is_active = TRUE
     ORDER BY i.quantity ASC`
  );
  res.json({ lowStock: result.rows });
});

/**
 * POST /api/inventory/:productId/adjust (owner only)
 * body: { change: number, movement_type: 'RESTOCK' | 'MANUAL_ADJUSTMENT' | 'CORRECTION', reference?: string }
 * `change` can be positive (add stock) or negative (remove stock).
 * Never allows the resulting quantity to go below zero.
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { change, movement_type = 'MANUAL_ADJUSTMENT', reference } = req.body;

  const changeAmount = Number(change);
  if (!Number.isInteger(changeAmount) || changeAmount === 0) {
    throw new ApiError(400, 'change must be a non-zero integer.');
  }
  const allowedTypes = ['RESTOCK', 'MANUAL_ADJUSTMENT', 'CORRECTION'];
  if (!allowedTypes.includes(movement_type)) {
    throw new ApiError(400, `movement_type must be one of: ${allowedTypes.join(', ')}`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const invResult = await client.query(
      'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    if (invResult.rows.length === 0) {
      throw new ApiError(404, 'Inventory record not found for this product.');
    }

    const current = invResult.rows[0];
    const newQuantity = current.quantity + changeAmount;
    if (newQuantity < 0) {
      throw new ApiError(400, `Insufficient stock. Current quantity is ${current.quantity}.`);
    }

    const updated = await client.query(
      'UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE product_id = $2 RETURNING *',
      [newQuantity, productId]
    );

    await client.query(
      `INSERT INTO stock_movements (product_id, quantity_change, movement_type, reference)
       VALUES ($1, $2, $3, $4)`,
      [productId, changeAmount, movement_type, reference || null]
    );

    await client.query('COMMIT');
    res.json({ inventory: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * PUT /api/inventory/:productId/threshold (owner only)
 */
const setThreshold = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { low_stock_threshold } = req.body;

  if (low_stock_threshold < 0) throw new ApiError(400, 'Threshold cannot be negative.');

  const result = await query(
    'UPDATE inventory SET low_stock_threshold = $1, updated_at = NOW() WHERE product_id = $2 RETURNING *',
    [low_stock_threshold, productId]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'Inventory record not found.');
  res.json({ inventory: result.rows[0] });
});

/**
 * GET /api/inventory/:productId/movements (owner only)
 */
const getMovements = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.productId]
  );
  res.json({ movements: result.rows });
});

module.exports = { listInventory, lowStock, adjustStock, setThreshold, getMovements };
