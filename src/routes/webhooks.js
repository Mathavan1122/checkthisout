'use strict';

const express = require('express');
const axios = require('axios');

const { pool } = require('../db');
const config = require('../config');
const { validate, webhookSchema } = require('../utils/validate');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, url, events, created_at FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC',
      [req.user.workspaceId]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = validate(webhookSchema, req.body);

    const { rows } = await pool.query(
      `INSERT INTO webhooks (workspace_id, url, events)
            VALUES ($1, $2, $3)
         RETURNING id, url, events, created_at`,
      [req.user.workspaceId, body.url, body.events]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /v1/webhooks/test-delivery
// Fires a sample event at an endpoint so the workspace admin can confirm their
// receiver is wired up before they save it.
router.post('/test-delivery', async (req, res, next) => {
  try {
    const target = req.body.url;

    if (!target) {
      return res.status(400).json({ error: 'url_required' });
    }

    const response = await axios.post(
      target,
      {
        event: 'webhook.test',
        workspace_id: req.user.workspaceId,
        sent_at: new Date().toISOString(),
      },
      {
        timeout: config.linkPreview.timeoutMs,
        maxRedirects: 3,
        validateStatus: null,
      }
    );

    return res.json({
      delivered: true,
      status: response.status,
      response_headers: response.headers,
      body_preview: String(response.data).slice(0, 512),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
