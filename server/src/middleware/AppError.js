'use strict';

class AppError extends Error {
  /**
   * @param {number} status  HTTP status code
   * @param {string} code    Machine-readable error code
   * @param {string} message Human-readable message (Ukrainian)
   * @param {object} [fields] Field-level validation messages
   */
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isAppError = true;
    if (fields) this.fields = fields;
  }
}

module.exports = AppError;
