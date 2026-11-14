'use strict';

// Canonical UUID shape (8-4-4-4-12 hex groups). Deliberately permissive about
// the version/variant nibbles so that placeholder ids such as
// 00000000-0000-0000-0000-000000000000 are accepted as "well-formed but absent".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { isUuid };
