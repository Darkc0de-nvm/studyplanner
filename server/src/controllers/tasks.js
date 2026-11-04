'use strict';
const tasksService = require('../services/tasks');
const { createTaskSchema, updateTaskSchema, listTasksSchema } = require('../schemas/tasks');

async function list(req, res, next) {
  try {
    const filters = listTasksSchema.parse(req.query);
    const tasks = await tasksService.list(req.user.id, filters);
    res.json({ tasks });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const task = await tasksService.getById(req.user.id, req.params.id);
    res.json({ task });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = createTaskSchema.parse(req.body);
    const task = await tasksService.create(req.user.id, data);
    res.status(201).json({ task });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await tasksService.update(req.user.id, req.params.id, data);
    res.json({ task });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await tasksService.remove(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
