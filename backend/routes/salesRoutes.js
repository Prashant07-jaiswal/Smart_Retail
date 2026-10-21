const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(authenticate, authorize('owner'));

router.post('/', requireFields('items', 'payment_method'), ctrl.createSale);
router.get('/', ctrl.listSales);
router.get('/export', ctrl.exportSalesCsv);

module.exports = router;
