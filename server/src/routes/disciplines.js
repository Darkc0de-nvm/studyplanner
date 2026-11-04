'use strict';
const { Router } = require('express');
const disciplinesController = require('../controllers/disciplines');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');
const validateUuidParam = require('../middleware/validateUuidParam');

const router = Router();
router.use(requireAuth);

router.get('/',      disciplinesController.list);
router.post('/',     originCheck, disciplinesController.create);
router.delete('/:id', validateUuidParam('id', 'Дисципліну не знайдено.'), originCheck, disciplinesController.remove);

module.exports = router;
