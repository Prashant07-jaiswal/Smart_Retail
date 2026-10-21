const { query } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * GET /api/products
 * Public: list active products. Supports ?search=&category=&page=&limit=
 */
const listProducts = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 50 } = req.query;
  const conditions = ['p.is_active = TRUE', '(p.expiry_date IS NULL OR p.expiry_date >= CURRENT_DATE)'];
  const params = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(p.name) LIKE $${params.length} OR p.barcode = $${params.length + 1})`);
    params.push(search);
  }
  if (category) {
    params.push(category);
    conditions.push(`p.category_id = $${params.length}`);
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT p.*, c.name AS category_name, COALESCE(i.quantity, 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE ${whereClause}
     ORDER BY p.name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({ products: result.rows });
});

/**
 * GET /api/products/:id
 */
const getProduct = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.name AS category_name, COALESCE(i.quantity, 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'Product not found.');
  res.json({ product: result.rows[0] });
});

/**
 * GET /api/products/barcode/:barcode
 * Used by POS + inventory lookups.
 */
const getProductByBarcode = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.name AS category_name, COALESCE(i.quantity, 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.barcode = $1`,
    [req.params.barcode]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'No product found for this barcode.');
  res.json({ product: result.rows[0] });
});

/**
 * POST /api/products (owner only)
 */
const createProduct = asyncHandler(async (req, res) => {
  const { name, barcode, description, price, category_id, initial_stock = 0, low_stock_threshold = 10, expiry_date } = req.body;

  if (price < 0) throw new ApiError(400, 'Price cannot be negative.');

  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `INSERT INTO products (name, barcode, description, price, category_id, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, barcode || null, description || null, price, category_id || null, expiry_date || null]
    );
    const product = productResult.rows[0];

    await client.query(
      `INSERT INTO inventory (product_id, quantity, low_stock_threshold) VALUES ($1, $2, $3)`,
      [product.id, initial_stock, low_stock_threshold]
    );

    if (initial_stock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_change, movement_type, reference)
         VALUES ($1, $2, 'RESTOCK', 'Initial stock on product creation')`,
        [product.id, initial_stock]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ product });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * PUT /api/products/:id (owner only)
 */
const updateProduct = asyncHandler(async (req, res) => {
  const { name, barcode, description, price, category_id, is_active, expiry_date } = req.body;

  const existing = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) throw new ApiError(404, 'Product not found.');

  const current = existing.rows[0];
  const result = await query(
    `UPDATE products
     SET name = $1, barcode = $2, description = $3, price = $4, category_id = $5, is_active = $6, expiry_date = $7
     WHERE id = $8 RETURNING *`,
    [
      name ?? current.name,
      barcode ?? current.barcode,
      description ?? current.description,
      price ?? current.price,
      category_id ?? current.category_id,
      is_active ?? current.is_active,
      // Explicit null clears an expiry date; undefined (field omitted) keeps the existing one.
      expiry_date !== undefined ? expiry_date : current.expiry_date,
      req.params.id,
    ]
  );
  res.json({ product: result.rows[0] });
});

/**
 * GET /api/products/expiring (owner only)
 * Optional ?days= (default 7) — products expiring within that window,
 * plus anything already expired, ordered soonest-first.
 */
const listExpiringProducts = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const windowDays = Number(days);
  if (!Number.isInteger(windowDays) || windowDays < 0) {
    throw new ApiError(400, 'days must be a non-negative integer.');
  }

  const result = await query(
    `SELECT p.id, p.name, p.barcode, p.expiry_date, COALESCE(i.quantity, 0) AS stock,
            (p.expiry_date < CURRENT_DATE) AS is_expired
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.is_active = TRUE
       AND p.expiry_date IS NOT NULL
       AND p.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
     ORDER BY p.expiry_date ASC`,
    [windowDays]
  );
  res.json({ expiringProducts: result.rows });
});

/**
 * DELETE /api/products/:id (owner only)
 * Soft-delete to preserve historical order/sales integrity.
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'Product not found.');
  res.json({ message: 'Product deactivated successfully.' });
});

/**
 * GET /api/categories
 */
const listCategories = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM categories ORDER BY name ASC');
  res.json({ categories: result.rows });
});

/**
 * POST /api/categories (owner only)
 */
const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json({ category: result.rows[0] });
});

module.exports = {
  listProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  listExpiringProducts,
};
