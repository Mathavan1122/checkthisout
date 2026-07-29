'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { validate, boundedInt, contactSchema, webhookSchema } = require('../src/utils/validate');

describe('validate(contactSchema)', () => {
  it('accepts a minimal contact and fills defaults', () => {
    const value = validate(contactSchema, { name: 'Aisyah Rahman' });

    assert.deepEqual(value, { name: 'Aisyah Rahman', channel: 'whatsapp', tags: [] });
  });

  it('strips unknown keys', () => {
    const value = validate(contactSchema, { name: 'Chen Wei', workspace_id: 'other-workspace' });

    assert.equal(value.workspace_id, undefined);
  });

  it('rejects an unsupported channel', () => {
    assert.throws(() => validate(contactSchema, { name: 'Budi', channel: 'pigeon' }), /channel/);
  });

  it('rejects a missing name', () => {
    assert.throws(() => validate(contactSchema, {}), /name/);
  });
});

describe('validate(webhookSchema)', () => {
  it('requires https', () => {
    assert.throws(
      () => validate(webhookSchema, { url: 'http://example.com/hook', events: ['message.created'] }),
      /url/
    );
  });

  it('accepts an https receiver', () => {
    const value = validate(webhookSchema, { url: 'https://example.com/hook', events: ['message.created'] });

    assert.equal(value.url, 'https://example.com/hook');
  });
});

describe('boundedInt', () => {
  const bounds = { min: 1, max: 200, fallback: 50 };

  it('falls back for non-numeric input', () => {
    assert.equal(boundedInt(undefined, bounds), 50);
    assert.equal(boundedInt('all', bounds), 50);
    assert.equal(boundedInt('', bounds), 50);
  });

  it('clamps to the range', () => {
    assert.equal(boundedInt('0', bounds), 1);
    assert.equal(boundedInt('9999', bounds), 200);
    assert.equal(boundedInt('-5', bounds), 1);
  });

  it('passes an in-range value through', () => {
    assert.equal(boundedInt('25', bounds), 25);
  });
});
