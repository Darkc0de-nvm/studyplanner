'use strict';
const { z } = require('zod');
const { stringError } = require('./messages');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validity is checked in UTC so the result does not depend on the host time zone.
function isRealDate(val) {
  const d = new Date(`${val}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
}

const dateStringSchema = z
  .string(stringError('Вкажіть дату.', 'Дата має бути рядком.'))
  .regex(DATE_RE, 'Дата повинна бути у форматі YYYY-MM-DD.')
  .refine(isRealDate, 'Вкажіть коректну дату (неіснуюча дата).');

const deadlineSchema = z
  .string(stringError('Вкажіть дату дедлайну.', 'Дата дедлайну має бути рядком.'))
  .regex(DATE_RE, 'Дата повинна бути у форматі YYYY-MM-DD.')
  .refine(isRealDate, 'Вкажіть коректний дедлайн (неіснуюча дата).');

const createTaskSchema = z.object({
  title: z
    .string(stringError('Назва обов\'язкова.', 'Назва має бути рядком.'))
    .trim()
    .min(3, 'Назва має містити від 3 до 100 символів.')
    .max(100, 'Назва не може перевищувати 100 символів.'),
  description: z
    .string({ error: 'Опис має бути рядком.' })
    .max(500, 'Опис не може перевищувати 500 символів.')
    .nullable()
    .optional(),
  disciplineId: z
    .string(stringError('Вкажіть дисципліну.', 'Невірний ідентифікатор дисципліни.'))
    .uuid('Невірний ідентифікатор дисципліни.'),
  deadline: deadlineSchema,
}).strict();

const updateTaskSchema = z
  .object({
    title: z
      .string({ error: 'Назва має бути рядком.' })
      .trim()
      .min(3, 'Назва має містити від 3 до 100 символів.')
      .max(100, 'Назва не може перевищувати 100 символів.')
      .optional(),
    description: z
      .string({ error: 'Опис має бути рядком.' })
      .max(500, 'Опис не може перевищувати 500 символів.')
      .nullable()
      .optional(),
    disciplineId: z
      .string({ error: 'Невірний ідентифікатор дисципліни.' })
      .uuid('Невірний ідентифікатор дисципліни.')
      .optional(),
    deadline: deadlineSchema.optional(),
    done: z
      .boolean({ error: 'Поле done має бути true або false.' })
      .optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, 'Вкажіть хоча б одне поле для оновлення.');

const listTasksSchema = z.object({
  q: z
    .string({ error: 'Пошуковий запит має бути рядком.' })
    .max(200, 'Пошуковий запит не може перевищувати 200 символів.')
    .optional(),
  discipline: z
    .string({ error: 'Невірний ідентифікатор дисципліни.' })
    .uuid('Невірний ідентифікатор дисципліни.')
    .optional(),
  done: z
    .enum(['true', 'false'], { error: 'Параметр done має бути true або false.' })
    .optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).strict();

module.exports = { createTaskSchema, updateTaskSchema, listTasksSchema };
