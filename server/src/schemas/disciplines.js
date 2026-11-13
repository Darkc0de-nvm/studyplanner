'use strict';
const { z } = require('zod');
const { stringError } = require('./messages');

const createDisciplineSchema = z.object({
  name: z
    .string(stringError('Назва дисципліни обов\'язкова.', 'Назва дисципліни має бути рядком.'))
    .trim()
    .min(2, 'Назва має містити від 2 до 100 символів.')
    .max(100, 'Назва не може перевищувати 100 символів.'),
  colorIndex: z
    .number({ error: 'Індекс кольору має бути числом.' })
    .int('Індекс кольору має бути цілим числом.')
    .min(1, 'Індекс кольору від 1 до 5.')
    .max(5, 'Індекс кольору від 1 до 5.')
    .default(1),
}).strict();

module.exports = { createDisciplineSchema };
