'use strict';
const { z } = require('zod');

const registerSchema = z.object({
  name: z
    .string({ required_error: 'Ім\'я обов\'язкове.' })
    .trim()
    .min(2, 'Ім\'я має містити щонайменше 2 символи.')
    .max(100, 'Ім\'я не може перевищувати 100 символів.'),
  email: z
    .string({ required_error: 'Email обов\'язковий.' })
    .email('Введіть коректну адресу email.')
    .max(255, 'Email не може перевищувати 255 символів.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Пароль обов\'язковий.' })
    .min(8, 'Пароль має містити щонайменше 8 символів.')
    .max(128, 'Пароль не може перевищувати 128 символів.'),
}).strict();

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email обов\'язковий.' })
    .email('Введіть коректну адресу email.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Пароль обов\'язковий.' })
    .min(1, 'Введіть пароль.'),
}).strict();

module.exports = { registerSchema, loginSchema };
