'use strict';
const pool = require('../db/pool');

async function deleteAccount(userId) {
  // ON DELETE CASCADE removes sessions, disciplines, tasks automatically
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

module.exports = { deleteAccount };
