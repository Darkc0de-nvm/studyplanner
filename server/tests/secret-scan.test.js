'use strict';

const { isPlaceholderDatabaseCredentials } = require('../scripts/secret-scan');

describe('database credential placeholder detection', () => {
  it('allows only explicit documentation placeholder pairs', () => {
    expect(isPlaceholderDatabaseCredentials('postgres://user:pass@')).toBe(true);
    expect(isPlaceholderDatabaseCredentials('postgresql://<user>:<password>@')).toBe(true);
  });

  it('does not allow arbitrary credentials', () => {
    const administratorCredentials = ['postgres:/', '/admin:password@'].join('');
    const userCredentials = ['postgres:/', '/user:secret@'].join('');

    expect(isPlaceholderDatabaseCredentials(administratorCredentials)).toBe(false);
    expect(isPlaceholderDatabaseCredentials(userCredentials)).toBe(false);
  });
});
