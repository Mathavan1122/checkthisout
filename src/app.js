'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const health = require('./routes/health');
const auth = require('./routes/auth');
const contacts = require('./routes/contacts');
const conversations = require('./routes/conversations');
const messages = require('./routes/messages');
const media = require('./routes/media');
const webhooks = require('./routes/webhooks');
const reports = require('./routes/reports');
const { requireUser } = require('./middleware/auth');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (config.env !== 'test') {
  app.use(morgan('combined'));
}

app.use(
  '/v1',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.use('/health', health);
app.use('/v1/auth', auth);
app.use('/v1/contacts', requireUser, contacts);
app.use('/v1/conversations', requireUser, conversations);
app.use('/v1/messages', requireUser, messages);
app.use('/v1/media', requireUser, media);
app.use('/v1/webhooks', requireUser, webhooks);
app.use('/v1/reports', requireUser, reports);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[app] unhandled error', err.message);
  }
  res.status(status).json({ error: err.code || 'internal_error', message: err.expose ? err.message : undefined });
});

module.exports = app;
