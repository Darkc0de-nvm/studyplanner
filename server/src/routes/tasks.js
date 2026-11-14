'use strict';
const { Router } = require('express');
const tasksController = require('../controllers/tasks');
const requireAuth = require('../middleware/requireAuth');
const originCheck = require('../middleware/originCheck');
const validateUuidParam = require('../middleware/validateUuidParam');

const router = Router();
router.use(requireAuth);

const taskNotFound = 'Завдання не знайдено.';

router.get('/',     tasksController.list);
router.post('/',    originCheck, tasksController.create);
router.get('/:id',  validateUuidParam('id', taskNotFound), tasksController.getById);
router.patch('/:id', validateUuidParam('id', taskNotFound), originCheck, tasksController.update);
router.delete('/:id', validateUuidParam('id', taskNotFound), originCheck, tasksController.remove);

module.exports = router;
