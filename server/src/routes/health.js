'use strict';
const { Router } = require('express');
const healthController = require('../controllers/health');

const router = Router();
router.get('/', healthController.health);

module.exports = router;
