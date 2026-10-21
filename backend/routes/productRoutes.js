const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// Public / any authenticated role
router.get('/', ctrl.listProducts);
router.get('/barcode/:barcode', ctrl.getProductByBarcode);
router.get('/expiring', authenticate, authorize('owner'), ctrl.listExpiringProducts);
router.get('/:id', ctrl.getProduct);

// Owner-only
router.post(
  '/',
  authenticate,
  authorize('owner'),
  requireFields('name', 'price'),
  ctrl.createProduct
);
router.put('/:id', authenticate, authorize('owner'), ctrl.updateProduct);
router.delete('/:id', authenticate, authorize('owner'), ctrl.deleteProduct);

module.exports = router;
