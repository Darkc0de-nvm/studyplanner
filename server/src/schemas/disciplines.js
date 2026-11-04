'use strict';
const { z } = require('zod');

const createDisciplineSchema = z.object({
  name: z
    .string({ required_error: 'Назва дисципліни обов\'язкова.' })
    .trim()
    .min(2, 'Назва має містити від 2 до 100 символів.')
    .max(100, 'Назва не може перевищувати 100 символів.'),
  colorIndex: z
    .number()
    .int()
    .min(1, 'Індекс кольору від 1 до 5.')
    .max(5, 'Індекс кольору від 1 до 5.')
    .default(1),
}).strict();

module.exports = { createDisciplineSchema };
