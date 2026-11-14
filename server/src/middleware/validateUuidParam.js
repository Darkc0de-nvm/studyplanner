'use strict';
const AppError = require('./AppError');
const { isUuid } = require('../utils/uuid');

/**
 * Rejects malformed :param values before they reach PostgreSQL.
 * A malformed id is reported as 404 so the API does not distinguish between
 * "does not exist" and "cannot exist".
 */
function validateUuidParam(name, notFoundMessage) {
  return function (req, _res, next) {
    if (!isUuid(req.params[name])) {
      return next(new AppError(404, 'NOT_FOUND', notFoundMessage));
    }
    next();
  };
}

module.exports = validateUuidParam;
