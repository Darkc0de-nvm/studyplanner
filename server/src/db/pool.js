'use strict';
const { Pool } = require('pg');
const config = require('../config');
const { buildPoolOptions } = require('./poolOptions');

const pool = new Pool(buildPoolOptions(config));

pool.on('error', (err) => {
  if (config.NODE_ENV !== 'test') {
    console.error('Unexpected DB pool error:', err.message);
  }
});

module.exports = pool;
