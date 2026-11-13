'use strict';
const { z } = require('zod');
const { stringError } = require('./messages');

const registerSchema = z.object({
  name: z
    .string(stringError('Ім\'я обов\'язкове.', 'Ім\'я має бути рядком.'))
    .trim()
    .min(2, 'Ім\'я має містити щонайменше 2 символи.')
    .max(100, 'Ім\'я не може перевищувати 100 символів.'),
  email: z
    .string(stringError('Email обов\'язковий.', 'Email має бути рядком.'))
    .email('Введіть коректну адресу email.')
    .max(255, 'Email не може перевищувати 255 символів.')
    .toLowerCase(),
  password: z
    .string(stringError('Пароль обов\'язковий.', 'Пароль має бути рядком.'))
    .min(8, 'Пароль має містити щонайменше 8 символів.')
    .max(128, 'Пароль не може перевищувати 128 символів.'),
  acceptedTerms: z.literal(true, { error: 'Щоб створити акаунт, потрібно погодитися з умовами' }),
}).strict();

const loginSchema = z.object({
  email: z
    .string(stringError('Email обов\'язковий.', 'Email має бути рядком.'))
    .email('Введіть коректну адресу email.')
    .toLowerCase(),
  password: z
    .string(stringError('Пароль обов\'язковий.', 'Пароль має бути рядком.'))
    .min(1, 'Введіть пароль.'),
}).strict();

module.exports = { registerSchema, loginSchema };
