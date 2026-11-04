'use strict';
const { Router } = require('express');
const authController = require('../controllers/auth');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');

const router = Router();

router.post('/register', originCheck, authController.register);
router.post('/login',    originCheck, authController.login);
router.post('/logout',   originCheck, requireAuth, authController.logout);
router.get('/me',        requireAuth, authController.me);

module.exports = router;
