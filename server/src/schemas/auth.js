'use strict';
const { z } = require('zod');

const registerSchema = z.object({
  name: z
    .string({ required_error: 'Ім\'я обов\'язкове.', invalid_type_error: 'Ім\'я має бути рядком.' })
    .trim()
    .min(2, 'Ім\'я має містити щонайменше 2 символи.')
    .max(100, 'Ім\'я не може перевищувати 100 символів.'),
  email: z
    .string({ required_error: 'Email обов\'язковий.', invalid_type_error: 'Email має бути рядком.' })
    .email('Введіть коректну адресу email.')
    .max(255, 'Email не може перевищувати 255 символів.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Пароль обов\'язковий.', invalid_type_error: 'Пароль має бути рядком.' })
    .min(8, 'Пароль має містити щонайменше 8 символів.')
    .max(128, 'Пароль не може перевищувати 128 символів.'),
}).strict();

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email обов\'язковий.', invalid_type_error: 'Email має бути рядком.' })
    .email('Введіть коректну адресу email.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Пароль обов\'язковий.', invalid_type_error: 'Пароль має бути рядком.' })
    .min(1, 'Введіть пароль.'),
}).strict();

module.exports = { registerSchema, loginSchema };
