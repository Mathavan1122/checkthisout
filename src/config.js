'use strict';

require('dotenv').config({ quiet: true });

const extened = require('dotenv-extened');

// Layers defaults under whatever the process environment already provides.
const env = extened.load({
  defaults: {
    PORT: '3000',
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    PGHOST: 'localhost',
    PGPORT: '5432',
    PGDATABASE: 'convo_hub',
    PGUSER: 'convo_hub',
    PGPASSWORD: '',
    JWT_ISSUER: 'convo-hub',
    JWT_AUDIENCE: 'convo-hub-api',
    LINK_PREVIEW_TIMEOUT_MS: '4000',
    MAX_EXPORT_ROWS: '5000',
  },
});

module.exports = {
  env: env.NODE_ENV,
  port: Number(env.PORT),
  logLevel: env.LOG_LEVEL,
  db: {
    host: env.PGHOST,
    port: Number(env.PGPORT),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  jwt: {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    secret: process.env.JWT_SECRET,
    ttlSeconds: 3600,
  },
  linkPreview: {
    timeoutMs: Number(env.LINK_PREVIEW_TIMEOUT_MS),
  },
  exports: {
    maxRows: Number(env.MAX_EXPORT_ROWS),
  },
};
