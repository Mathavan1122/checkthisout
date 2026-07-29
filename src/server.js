'use strict';

const app = require('./app');
const config = require('./config');
const { shutdown } = require('./db');

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`convo-hub-api listening on :${config.port} (${config.env})`);
});

function stop(signal) {
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received, draining`);
  server.close(() => {
    shutdown()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

module.exports = server;
