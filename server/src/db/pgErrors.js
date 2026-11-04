'use strict';
const AppError = require('../middleware/AppError');

function isUniqueViolation(err) {
  return Boolean(err) && err.code === '23505';
}

function isForeignKeyViolation(err) {
  return Boolean(err) && err.code === '23503';
}

/**
 * Fallback translation of low-level PostgreSQL errors that were not handled
 * explicitly in a service. Keeps malformed input from surfacing as HTTP 500.
 */
function mapPgError(err) {
  if (!err || typeof err.code !== 'string') return err;

  switch (err.code) {
    case '23505':
      return new AppError(409, 'CONFLICT', 'Запис із такими даними вже існує.');
    case '23503':
      return new AppError(409, 'CONFLICT', 'Операція порушує цілісність даних.');
    case '22P02':
      return new AppError(400, 'BAD_REQUEST', 'Некоректний формат ідентифікатора.');
    case '22007':
    case '22008':
      return new AppError(422, 'VALIDATION_ERROR', 'Некоректне значення дати.');
    default:
      return err;
  }
}

module.exports = { isUniqueViolation, isForeignKeyViolation, mapPgError };
