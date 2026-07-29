'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const fixtures = require('./fixtures');

// The signing key is read from the environment when src/config.js loads, so it
// has to be in place before anything under src/ is required.
process.env.JWT_SECRET = process.env.JWT_SECRET || fixtures.TEST_JWT_SECRET;

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const config = require('../src/config');
const { requireUser, requireRole } = require('../src/middleware/auth');

function buildHarness() {
  const app = express();
  app.get('/me', requireUser, (req, res) => res.json(req.user));
  app.get('/admin', requireUser, requireRole('admin', 'owner'), (req, res) => res.json({ ok: true }));
  return app;
}

function issueToken(claims = {}, options = {}) {
  return jwt.sign(
    {
      sub: fixtures.SAMPLE_USER_ID,
      workspace_id: fixtures.SAMPLE_WORKSPACE_ID,
      email: 'agent@example.com',
      role: 'agent',
      ...claims,
    },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: 300,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      ...options,
    }
  );
}

describe('requireUser', () => {
  const app = buildHarness();

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'missing_access_token');
  });

  it('rejects a token the platform did not sign', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${fixtures.SAMPLE_MALFORMED_TOKEN}`);

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'invalid_access_token');
  });

  it('rejects an expired token', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${issueToken({}, { expiresIn: -60 })}`);

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'invalid_access_token');
  });

  it('rejects a token with no workspace scope', async () => {
    const token = jwt.sign({ sub: fixtures.SAMPLE_USER_ID }, config.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: 300,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'malformed_access_token');
  });

  it('attaches the caller and their workspace scope', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${issueToken()}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, fixtures.SAMPLE_USER_ID);
    assert.equal(res.body.workspaceId, fixtures.SAMPLE_WORKSPACE_ID);
    assert.equal(res.body.role, 'agent');
  });
});

describe('requireRole', () => {
  const app = buildHarness();

  it('blocks a role that is not allowed', async () => {
    const res = await request(app).get('/admin').set('Authorization', `Bearer ${issueToken()}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'insufficient_role');
  });

  it('lets an allowed role through', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${issueToken({ role: 'owner' })}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
  });
});
