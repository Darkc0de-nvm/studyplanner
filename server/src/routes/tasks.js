'use strict';
const { Router } = require('express');
const tasksController = require('../controllers/tasks');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');

const router = Router();
router.use(requireAuth);

router.get('/',     tasksController.list);
router.post('/',    originCheck, tasksController.create);
router.get('/:id',  tasksController.getById);
router.patch('/:id', originCheck, tasksController.update);
router.delete('/:id', originCheck, tasksController.remove);

module.exports = router;
