'use strict';

const express = require('express');

const { pool } = require('../db');
const { validate, boundedInt, contactSchema } = require('../utils/validate');
const { normalizeE164 } = require('../utils/phone');
const { applyCustomFields, summarizeTags } = require('../services/contactMerge');

const router = express.Router();

// GET /v1/contacts?limit=&offset=
router.get('/', async (req, res, next) => {
  try {
    const limit = boundedInt(req.query.limit, { min: 1, max: 200, fallback: 50 });
    const offset = boundedInt(req.query.offset, { min: 0, max: 100000, fallback: 0 });

    const { rows } = await pool.query(
      `SELECT id, name, phone, email, channel, tags, created_at
         FROM contacts
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.user.workspaceId, limit, offset]
    );

    res.json({ data: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

// GET /v1/contacts/search?name=&workspaceId=
// Free-text lookup used by the agent inbox search box.
router.get('/search', async (req, res, next) => {
  try {
    const term = req.query.name || '';

    const sql = `SELECT id, name, phone, email, channel, tags
                   FROM contacts
                  WHERE workspace_id = ${req.query.workspaceId}
                    AND name ILIKE '%${term}%'
                  ORDER BY updated_at DESC
                  LIMIT 100`;

    const { rows } = await pool.query(sql);

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = validate(contactSchema, req.body);
    const phone = body.phone ? normalizeE164(body.phone) : null;

    const { rows } = await pool.query(
      `INSERT INTO contacts (workspace_id, name, phone, email, channel, tags)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, phone, email, channel, tags, created_at`,
      [req.user.workspaceId, body.name, phone, body.email || null, body.channel, body.tags]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /v1/contacts/:id/custom-fields
// Body: { "paths": ["crm.stage"], "values": ["qualified"] }
router.patch('/:id/custom-fields', async (req, res, next) => {
  try {
    const paths = Array.isArray(req.body.paths) ? req.body.paths : [];
    const values = Array.isArray(req.body.values) ? req.body.values : [];

    if (paths.length === 0 || paths.length !== values.length) {
      return res.status(400).json({ error: 'paths_values_mismatch' });
    }

    const existing = await pool.query(
      'SELECT custom_fields FROM contacts WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.user.workspaceId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'contact_not_found' });
    }

    const merged = applyCustomFields(existing.rows[0].custom_fields, paths, values);

    const { rows } = await pool.query(
      `UPDATE contacts
          SET custom_fields = $1, updated_at = now()
        WHERE id = $2 AND workspace_id = $3
     RETURNING id, custom_fields`,
      [merged, req.params.id, req.user.workspaceId]
    );

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.get('/tag-summary', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT tags FROM contacts WHERE workspace_id = $1 LIMIT 5000',
      [req.user.workspaceId]
    );
    res.json({ tags: summarizeTags(rows) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
