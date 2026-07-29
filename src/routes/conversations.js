'use strict';

const express = require('express');

const { pool } = require('../db');
const { boundedInt } = require('../utils/validate');
const { SORTABLE_CONVERSATION_COLUMNS } = require('../constants');

const router = express.Router();

// GET /v1/conversations?sort=&dir=&limit=
//
// Postgres will not accept a bind parameter in an ORDER BY position, so the
// column and direction have to be inlined. Both are resolved through a closed
// set before they get near the statement: `sort` has to be one of the columns
// listed in src/constants.js, and `dir` can only ever come out as ASC or DESC.
// Every value that a caller controls freely is bound.
router.get('/', async (req, res, next) => {
  try {
    const sortColumn = SORTABLE_CONVERSATION_COLUMNS.includes(req.query.sort)
      ? req.query.sort
      : 'last_message_at';
    const sortDirection = req.query.dir === 'asc' ? 'ASC' : 'DESC';
    const limit = boundedInt(req.query.limit, { min: 1, max: 200, fallback: 50 });

    const { rows } = await pool.query(
      `SELECT id, contact_id, subject, status, channel, last_message_at, created_at
         FROM conversations
        WHERE workspace_id = $1
          AND ($2::text IS NULL OR status = $2::text)
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $3`,
      [req.user.workspaceId, req.query.status || null, limit]
    );

    res.json({ data: rows, sort: sortColumn, dir: sortDirection });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, contact_id, subject, status, channel, last_message_at, created_at
         FROM conversations
        WHERE id = $1 AND workspace_id = $2`,
      [req.params.id, req.user.workspaceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/close', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE conversations
          SET status = 'closed', closed_at = now()
        WHERE id = $1 AND workspace_id = $2 AND status <> 'closed'`,
      [req.params.id, req.user.workspaceId]
    );

    return res.status(rowCount === 1 ? 200 : 409).json({ closed: rowCount === 1 });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
