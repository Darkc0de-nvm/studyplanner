'use strict';
const { Router } = require('express');
const accountController = require('../controllers/account');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');
const { authLimiter } = require('../middleware/rateLimiters');

const router = Router();

router.post('/delete', authLimiter, originCheck, requireAuth, accountController.deleteAccount);
router.post('/password', authLimiter, originCheck, requireAuth, accountController.changePassword);

module.exports = router;
