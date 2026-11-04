'use strict';
const { mapPgError, isUniqueViolation, isForeignKeyViolation } = require('../src/db/pgErrors');
const AppError = require('../src/middleware/AppError');

describe('pgErrors', () => {
  it('detects unique and foreign key violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
    expect(isForeignKeyViolation(null)).toBe(false);
  });

  it.each([
    ['23505', 409, 'CONFLICT'],
    ['23503', 409, 'CONFLICT'],
    ['22P02', 400, 'BAD_REQUEST'],
    ['22007', 422, 'VALIDATION_ERROR'],
    ['22008', 422, 'VALIDATION_ERROR'],
  ])('maps PostgreSQL code %s to %i %s', (code, status, errorCode) => {
    const err = Object.assign(new Error('pg'), { code });
    const mapped = mapPgError(err);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.status).toBe(status);
    expect(mapped.code).toBe(errorCode);
  });

  it('leaves unknown errors untouched', () => {
    const err = Object.assign(new Error('boom'), { code: 'XX000' });
    expect(mapPgError(err)).toBe(err);
    const plain = new Error('plain');
    expect(mapPgError(plain)).toBe(plain);
  });
});
