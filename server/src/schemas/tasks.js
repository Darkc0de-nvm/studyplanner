'use strict';
const { z } = require('zod');

// Validate YYYY-MM-DD and that it's a real date (e.g., not 2026-02-31)
const deadlineSchema = z
  .string({ required_error: 'Вкажіть дату дедлайну.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата повинна бути у форматі YYYY-MM-DD.')
  .refine((val) => {
    const d = new Date(val + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
  }, 'Вкажіть коректний дедлайн (неіснуюча дата).');

const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Назва обов\'язкова.' })
    .trim()
    .min(3, 'Назва має містити від 3 до 100 символів.')
    .max(100, 'Назва не може перевищувати 100 символів.'),
  description: z
    .string()
    .max(500, 'Опис не може перевищувати 500 символів.')
    .nullable()
    .optional(),
  disciplineId: z
    .string({ required_error: 'Вкажіть дисципліну.' })
    .uuid('Невірний ідентифікатор дисципліни.'),
  deadline: deadlineSchema,
}).strict();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    disciplineId: z.string().uuid().optional(),
    deadline: deadlineSchema.optional(),
    done: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, 'Вкажіть хоча б одне поле для оновлення.');

const listTasksSchema = z.object({
  q: z.string().max(200).optional(),
  discipline: z.string().uuid().optional(),
  done: z.enum(['true', 'false']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

module.exports = { createTaskSchema, updateTaskSchema, listTasksSchema };
