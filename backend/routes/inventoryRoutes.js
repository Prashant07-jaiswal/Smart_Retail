const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(authenticate, authorize('owner'));

router.get('/', ctrl.listInventory);
router.get('/low-stock', ctrl.lowStock);
router.get('/:productId/movements', ctrl.getMovements);
router.post('/:productId/adjust', requireFields('change'), ctrl.adjustStock);
router.put('/:productId/threshold', requireFields('low_stock_threshold'), ctrl.setThreshold);

module.exports = router;
