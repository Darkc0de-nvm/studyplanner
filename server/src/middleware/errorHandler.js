'use strict';
const config = require('../config');
const { mapPgError } = require('../db/pgErrors');

function errorHandler(err, req, res, _next) {
  // Zod validation error
  if (err.name === 'ZodError') {
    const fields = {};
    for (const issue of err.errors) {
      const key = issue.path.join('.') || '_';
      fields[key] = issue.message;
    }
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Помилка валідації вхідних даних.',
        fields,
      },
    });
  }

  // Known application error
  if (err.isAppError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.fields) body.error.fields = err.fields;
    return res.status(err.status).json(body);
  }

  // Express body-parser errors (malformed JSON etc.)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Невалідний JSON у тілі запиту.' },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Тіло запиту занадто велике.' },
    });
  }

  // PostgreSQL errors that no service handled explicitly (constraint, bad uuid,
  // out-of-range date). Translate them before falling back to 500.
  const pgError = mapPgError(err);
  if (pgError !== err) {
    return errorHandler(pgError, req, res, _next);
  }

  // Unknown errors
  if (config.NODE_ENV !== 'test') {
    console.error('[ERROR]', err.message, err.stack);
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.NODE_ENV === 'production'
        ? 'Внутрішня помилка сервера.'
        : err.message || 'Внутрішня помилка сервера.',
    },
  });
}

module.exports = errorHandler;
