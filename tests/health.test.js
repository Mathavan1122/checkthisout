'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

describe('GET /health', () => {
  it('reports ok with the serving runtime', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(typeof res.body.runtime, 'string');
    assert.ok(res.body.runtime.length > 0);
    assert.equal(res.body.runtime_supported, true);
    assert.equal(typeof res.body.uptime_seconds, 'number');
  });

  it('reports readiness', async () => {
    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ready' });
  });
});

describe('unknown routes', () => {
  it('responds 404 with the path', async () => {
    const res = await request(app).get('/v1/does-not-exist');

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'not_found');
  });
});
