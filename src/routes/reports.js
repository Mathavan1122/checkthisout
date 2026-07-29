'use strict';

const express = require('express');
const JSZip = require('jszip');
const dayjs = require('dayjs');

const { pool } = require('../db');
const config = require('../config');
const { funnel, responseTimes } = require('../services/analytics');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /v1/reports/funnel
router.get('/funnel', async (req, res, next) => {
  try {
    const since = dayjs().subtract(30, 'day').toISOString();

    const { rows } = await pool.query(
      `SELECT id, status, channel, created_at, closed_at
         FROM conversations
        WHERE workspace_id = $1 AND created_at >= $2`,
      [req.user.workspaceId, since]
    );

    res.json({ since, funnel: funnel(rows) });
  } catch (err) {
    next(err);
  }
});

// GET /v1/reports/response-times
router.get('/response-times', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.direction, m.created_at
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.workspace_id = $1
        ORDER BY m.created_at ASC
        LIMIT $2`,
      [req.user.workspaceId, config.exports.maxRows]
    );

    res.json({ histogram: responseTimes(rows) });
  } catch (err) {
    next(err);
  }
});

// GET /v1/reports/export.zip
// Admin-only bulk export of the workspace's conversation history.
router.get('/export.zip', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.subject, c.status, c.channel, c.created_at, ct.name AS contact_name
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.workspace_id = $1
        ORDER BY c.created_at DESC
        LIMIT $2`,
      [req.user.workspaceId, config.exports.maxRows]
    );

    const header = 'id,subject,status,channel,created_at,contact_name\n';
    const csv = rows
      .map((r) => [r.id, r.subject, r.status, r.channel, r.created_at, r.contact_name]
        .map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`)
        .join(','))
      .join('\n');

    const zip = new JSZip();
    zip.file('conversations.csv', header + csv);
    zip.file('README.txt', `Export generated ${dayjs().toISOString()} for workspace ${req.user.workspaceId}\n`);

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="conversations-export.zip"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
