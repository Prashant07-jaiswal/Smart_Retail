const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.get('/', ctrl.listCategories);
router.post('/', authenticate, authorize('owner'), requireFields('name'), ctrl.createCategory);

module.exports = router;
