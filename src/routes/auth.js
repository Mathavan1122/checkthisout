'use strict';

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const { pool } = require('../db');
const config = require('../config');
const { validate } = require('../utils/validate');

const router = express.Router();

const tokenRequestSchema = Joi.object({
  email: Joi.string().email().max(200).required(),
  password: Joi.string().min(8).max(200).required(),
});

function scryptVerify(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/token', async (req, res, next) => {
  try {
    const body = validate(tokenRequestSchema, req.body);

    if (!config.jwt.secret) {
      const err = new Error('signing key is not configured');
      err.status = 500;
      err.code = 'signing_key_missing';
      throw err;
    }

    const { rows } = await pool.query(
      'SELECT id, workspace_id, email, role, password_hash FROM users WHERE email = $1 AND disabled_at IS NULL',
      [body.email]
    );

    const user = rows[0];
    if (!user || !scryptVerify(body.password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        workspace_id: user.workspace_id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwt.ttlSeconds,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }
    );

    return res.json({ access_token: token, token_type: 'Bearer', expires_in: config.jwt.ttlSeconds });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
