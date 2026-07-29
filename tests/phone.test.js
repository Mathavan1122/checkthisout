'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeE164, isE164 } = require('../src/utils/phone');

describe('normalizeE164', () => {
  it('keeps an already international number', () => {
    assert.equal(normalizeE164('+60 12-345 6789'), '+60123456789');
  });

  it('applies the workspace country prefix and drops the trunk zero', () => {
    assert.equal(normalizeE164('012-345 6789', 'MY'), '+60123456789');
    assert.equal(normalizeE164('0812 3456 789', 'ID'), '+628123456789');
  });

  it('rejects junk and out-of-range lengths', () => {
    assert.equal(normalizeE164(''), null);
    assert.equal(normalizeE164('   '), null);
    assert.equal(normalizeE164('abc'), null);
    assert.equal(normalizeE164('12345', 'MY'), null);
    assert.equal(normalizeE164(undefined), null);
    assert.equal(normalizeE164('0123456789', 'ZZ'), null);
  });
});

describe('isE164', () => {
  it('accepts a well-formed number', () => {
    assert.equal(isE164('+60123456789'), true);
  });

  it('rejects anything else', () => {
    assert.equal(isE164('60123456789'), false);
    assert.equal(isE164('+0123456789'), false);
    assert.equal(isE164(12345), false);
  });
});
