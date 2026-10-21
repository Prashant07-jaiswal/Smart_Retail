const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.post('/register', requireFields('name', 'email', 'password'), register);
router.post('/login', requireFields('email', 'password'), login);
router.get('/me', authenticate, me);

module.exports = router;
