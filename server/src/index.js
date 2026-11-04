'use strict';
const app = require('./app');
const pool = require('./db/pool');
const config = require('./config');

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(
    `✅ StudyPlanner server listening on http://0.0.0.0:${config.PORT} [${config.NODE_ENV}]`
  );
});

async function shutdown(signal) {
  console.log(`\n${signal} received — graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (err) {
      console.error('Error closing pool:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = server;
