const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(authenticate);

router.post('/', authorize('customer'), requireFields('items'), ctrl.createOrder);
router.get('/mine', authorize('customer'), ctrl.listMyOrders);
router.get('/', authorize('owner'), ctrl.listAllOrders);
router.get('/:id', ctrl.getOrder);
router.put('/:id/status', authorize('owner'), requireFields('status'), ctrl.updateOrderStatus);

module.exports = router;
