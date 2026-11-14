'use strict';
const { Router } = require('express');
const authController = require('../controllers/auth');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');
const { authLimiter, apiLimiter } = require('../middleware/rateLimiters');

const router = Router();

router.post('/register', authLimiter, originCheck, authController.register);
router.post('/login',    authLimiter, originCheck, authController.login);
router.post('/logout',   apiLimiter, originCheck, requireAuth, authController.logout);
router.get('/me',        apiLimiter, requireAuth, authController.me);

module.exports = router;
