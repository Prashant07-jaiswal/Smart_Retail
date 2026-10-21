const { query, getClient } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { emitNewOrder, emitOrderStatusUpdate, emitLowStockAlert } = require('../sockets');

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'];

// Which status transitions the owner is allowed to make.
const ALLOWED_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'REJECTED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
};

/**
 * POST /api/orders (customer)
 * body: { items: [{ product_id, quantity }] }
 *
 * Stock is only VALIDATED here (not deducted) — actual deduction happens
 * when the owner ACCEPTS the order, per the documented inventory strategy.
 */
const createOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Order must contain at least one item.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let total = 0;
    const resolvedItems = [];

    for (const { product_id, quantity } of items) {
      if (!product_id || !Number.isInteger(quantity) || quantity <= 0) {
        throw new ApiError(400, 'Each item needs a valid product_id and a positive integer quantity.');
      }

      const productResult = await client.query(
        `SELECT p.id, p.name, p.price, p.is_active, p.expiry_date, COALESCE(i.quantity, 0) AS stock
         FROM products p LEFT JOIN inventory i ON i.product_id = p.id
         WHERE p.id = $1 FOR UPDATE OF p`,
        [product_id]
      );
      if (productResult.rows.length === 0 || !productResult.rows[0].is_active) {
        throw new ApiError(404, `Product ${product_id} is not available.`);
      }
      const product = productResult.rows[0];
      if (product.expiry_date && new Date(product.expiry_date) < new Date(new Date().toDateString())) {
        throw new ApiError(400, `"${product.name}" has expired and cannot be ordered.`);
      }
      if (product.stock < quantity) {
        throw new ApiError(400, `Insufficient stock for "${product.name}". Available: ${product.stock}.`);
      }

      total += Number(product.price) * quantity;
      resolvedItems.push({ product_id, quantity, price: product.price });
    }

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, status, total_amount) VALUES ($1, 'PENDING', $2) RETURNING *`,
      [req.user.id, total.toFixed(2)]
    );
    const order = orderResult.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');

    const fullOrder = await getOrderWithItems(order.id);
    const io = req.app.get('io');
    if (io) emitNewOrder(io, fullOrder);

    res.status(201).json({ order: fullOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

async function getOrderWithItems(orderId) {
  const orderResult = await query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (orderResult.rows.length === 0) return null;

  const itemsResult = await query(
    `SELECT oi.*, p.name AS product_name, p.barcode
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  return { ...orderResult.rows[0], items: itemsResult.rows };
}

/**
 * GET /api/orders/mine (customer)
 */
const listMyOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.*, (
        SELECT json_agg(json_build_object(
          'product_id', oi.product_id, 'product_name', p.name,
          'quantity', oi.quantity, 'price', oi.price
        ))
        FROM order_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ) AS items
     FROM orders o
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

/**
 * GET /api/orders (owner) — optional ?status= filter
 */
const listAllOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE o.status = $1';
  }

  const result = await query(
    `SELECT o.*, u.name AS customer_name, (
        SELECT json_agg(json_build_object(
          'product_id', oi.product_id, 'product_name', p.name,
          'quantity', oi.quantity, 'price', oi.price
        ))
        FROM order_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ) AS items
     FROM orders o
     JOIN users u ON u.id = o.customer_id
     ${where}
     ORDER BY o.created_at DESC`,
    params
  );
  res.json({ orders: result.rows });
});

/**
 * GET /api/orders/:id (owner, or the customer who placed it)
 */
const getOrder = asyncHandler(async (req, res) => {
  const order = await getOrderWithItems(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (req.user.role !== 'owner' && order.customer_id !== req.user.id) {
    throw new ApiError(403, 'You do not have access to this order.');
  }
  res.json({ order });
});

/**
 * PUT /api/orders/:id/status (owner only)
 * body: { status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'REJECTED' }
 *
 * Inventory strategy:
 * - PENDING -> ACCEPTED: deduct stock now (first and only deduction point), mark stock_reserved.
 * - ACCEPTED -> REJECTED: restore the previously deducted stock.
 * - PENDING -> REJECTED: no stock was ever deducted, nothing to restore.
 * - All other forward transitions (PREPARING, READY, COMPLETED) do not touch inventory.
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, payment_method } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  // Payment method is only required when completing an order (that's the
  // moment the customer actually pays, in person, at handover/pickup).
  if (status === 'COMPLETED' && payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    throw new ApiError(400, `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (orderResult.rows.length === 0) throw new ApiError(404, 'Order not found.');
    const order = orderResult.rows[0];

    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      throw new ApiError(400, `Cannot move order from ${order.status} to ${status}.`);
    }

    const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    const items = itemsResult.rows;

    // Case 1: accepting a pending order -> deduct stock now.
    if (order.status === 'PENDING' && status === 'ACCEPTED') {
      for (const item of items) {
        const invResult = await client.query(
          'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
          [item.product_id]
        );
        const inv = invResult.rows[0];
        if (!inv || inv.quantity < item.quantity) {
          throw new ApiError(
            400,
            `Cannot accept order — insufficient stock for product ${item.product_id}. ` +
              `Available: ${inv ? inv.quantity : 0}, needed: ${item.quantity}.`
          );
        }
        const newQty = inv.quantity - item.quantity;
        await client.query(
          'UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE product_id = $2',
          [newQty, item.product_id]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_change, movement_type, reference)
           VALUES ($1, $2, 'ORDER_RESERVE', $3)`,
          [item.product_id, -item.quantity, `ORDER-${order.id}`]
        );

        // Fire a low-stock alert if this deduction crossed the threshold.
        const thresholdCheck = await client.query(
          'SELECT quantity, low_stock_threshold FROM inventory WHERE product_id = $1',
          [item.product_id]
        );
        const row = thresholdCheck.rows[0];
        if (row.quantity <= row.low_stock_threshold) {
          const io = req.app.get('io');
          if (io) {
            const prodInfo = await client.query('SELECT id, name FROM products WHERE id = $1', [item.product_id]);
            emitLowStockAlert(io, { ...prodInfo.rows[0], quantity: row.quantity });
          }
        }
      }
      await client.query('UPDATE orders SET stock_reserved = TRUE WHERE id = $1', [order.id]);
    }

    // Case 2: rejecting an order that already had stock deducted -> restore it.
    if (order.status === 'ACCEPTED' && status === 'REJECTED' && order.stock_reserved) {
      for (const item of items) {
        await client.query(
          'UPDATE inventory SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2',
          [item.quantity, item.product_id]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_change, movement_type, reference)
           VALUES ($1, $2, 'ORDER_RESTORE', $3)`,
          [item.product_id, item.quantity, `ORDER-${order.id}-restored`]
        );
      }
      await client.query('UPDATE orders SET stock_reserved = FALSE WHERE id = $1', [order.id]);
    }

    // Case 3: completing an order -> this is when the customer actually pays
    // (in person, at pickup/handover), so we record it in sales with the
    // payment method the owner just collected, and build a printable receipt.
    let receipt = null;
    if (status === 'COMPLETED') {
      const finalPaymentMethod = payment_method || 'CASH';
      const receiptNo = `ORDER-${order.id}`;
      const receiptItems = [];

      for (const item of items) {
        const lineTotal = item.price * item.quantity;
        await client.query(
          `INSERT INTO sales (product_id, quantity, total_amount, payment_method, receipt_no, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [item.product_id, item.quantity, lineTotal.toFixed(2), finalPaymentMethod, receiptNo]
        );
        const prodInfo = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        receiptItems.push({
          product_name: prodInfo.rows[0]?.name || `Product #${item.product_id}`,
          quantity: item.quantity,
          total_amount: lineTotal.toFixed(2),
        });
      }

      receipt = {
        receipt_no: receiptNo,
        items: receiptItems,
        grand_total: order.total_amount,
        payment_method: finalPaymentMethod,
        created_at: new Date().toISOString(),
      };
    }

    await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, order.id]);
    await client.query('COMMIT');

    const fullOrder = await getOrderWithItems(order.id);
    const io = req.app.get('io');
    if (io) emitOrderStatusUpdate(io, order.customer_id, fullOrder);

    res.json({ order: fullOrder, receipt });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { createOrder, listMyOrders, listAllOrders, getOrder, updateOrderStatus };
