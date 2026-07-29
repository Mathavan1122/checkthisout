'use strict';

const { Pool } = require('pg');
const config = require('./config');

// The pool is lazy: pg does not open a socket until the first query is issued,
// so the process boots cleanly in environments without a database attached.
const pool = new Pool(config.db);

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] idle client error', err.message);
});

async function shutdown() {
  await pool.end();
}

module.exports = { pool, shutdown };
