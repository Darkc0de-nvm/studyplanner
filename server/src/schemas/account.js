'use strict';
const { z } = require('zod');
const { stringError } = require('./messages');
const { passwordSchema } = require('./auth');

const verifyPasswordSchema = z.object({
  password: z.string(stringError('Пароль обов\'язковий.', 'Пароль має бути рядком.')).min(1, 'Введіть пароль.'),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string(stringError('Поточний пароль обов\'язковий.', 'Пароль має бути рядком.')).min(1, 'Введіть поточний пароль.'),
  newPassword: passwordSchema,
}).strict().refine(data => data.currentPassword !== data.newPassword, {
  path: ['newPassword'],
  message: 'Новий пароль має відрізнятися від поточного.',
});

module.exports = { verifyPasswordSchema, changePasswordSchema };
