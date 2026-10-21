const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/summary', authenticate, authorize('owner'), ctrl.summary);

module.exports = router;
