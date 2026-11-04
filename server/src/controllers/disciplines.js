'use strict';
const disciplinesService = require('../services/disciplines');
const { createDisciplineSchema } = require('../schemas/disciplines');

async function list(req, res, next) {
  try {
    const disciplines = await disciplinesService.list(req.user.id);
    res.json({ disciplines });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, colorIndex } = createDisciplineSchema.parse(req.body);
    const discipline = await disciplinesService.create(req.user.id, name, colorIndex);
    res.status(201).json({ discipline });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await disciplinesService.remove(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, create, remove };
