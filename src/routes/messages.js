'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const { pool } = require('../db');
const { validate, boundedInt, outboundMessageSchema } = require('../utils/validate');
const { renderForContact, placeholders } = require('../services/templateRender');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = boundedInt(req.query.limit, { min: 1, max: 200, fallback: 50 });

    const { rows } = await pool.query(
      `SELECT m.id, m.conversation_id, m.direction, m.channel, m.body, m.created_at
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.workspace_id = $1
          AND ($2::uuid IS NULL OR m.conversation_id = $2::uuid)
        ORDER BY m.created_at DESC
        LIMIT $3`,
      [req.user.workspaceId, req.query.conversation_id || null, limit]
    );

    res.json({ data: rows, limit });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = validate(outboundMessageSchema, req.body);

    const convo = await pool.query(
      `SELECT c.id, c.contact_id, ct.name, ct.channel
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.id = $1 AND c.workspace_id = $2`,
      [body.conversation_id, req.user.workspaceId]
    );

    if (convo.rows.length === 0) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    const rendered = renderForContact(body.template, convo.rows[0], body.variables);
    const messageId = uuidv4();

    await pool.query(
      `INSERT INTO messages (id, conversation_id, direction, channel, body, created_at)
            VALUES ($1, $2, 'outbound', $3, $4, now())`,
      [messageId, body.conversation_id, body.channel, rendered]
    );

    return res.status(202).json({
      id: messageId,
      conversation_id: body.conversation_id,
      body: rendered,
      queued_at: dayjs().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

// Lets the template editor show which slots a draft will need filled.
router.post('/template/preview', (req, res, next) => {
  try {
    const template = String(req.body.template || '');
    res.json({
      placeholders: placeholders(template),
      preview: renderForContact(template, { name: 'Sample Contact', channel: 'whatsapp' }, req.body.variables),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
