'use strict';

const express = require('express');
const semver = require('semver');

const { runtimeFingerprint } = require('../utils/systemInfo');
const config = require('../config');
const { engines } = require('../../package.json');

const router = express.Router();

const startedAt = Date.now();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    env: config.env,
    runtime: runtimeFingerprint(),
    // Deploys have landed on the wrong Node line before, so the probe reports
    // whether the running version still matches what the service declares.
    runtime_supported: semver.satisfies(process.versions.node, engines.node),
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

router.get('/ready', (req, res) => {
  res.json({ status: 'ready' });
});

module.exports = router;
