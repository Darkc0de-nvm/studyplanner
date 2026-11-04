'use strict';
const { Router } = require('express');
const accountController = require('../controllers/account');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');

const router = Router();

router.delete('/', originCheck, requireAuth, accountController.deleteAccount);

module.exports = router;
