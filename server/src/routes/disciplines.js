'use strict';
const { Router } = require('express');
const disciplinesController = require('../controllers/disciplines');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');

const router = Router();
router.use(requireAuth);

router.get('/',      disciplinesController.list);
router.post('/',     originCheck, disciplinesController.create);
router.delete('/:id', originCheck, disciplinesController.remove);

module.exports = router;
