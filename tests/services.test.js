'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { expandCustomFields, applyCustomFields, summarizeTags } = require('../src/services/contactMerge');
const { renderTemplate, renderForContact, placeholders } = require('../src/services/templateRender');
const { funnel, responseTimes } = require('../src/services/analytics');
const fixtures = require('./fixtures');

describe('contactMerge', () => {
  it('expands dotted paths into a nested object', () => {
    assert.deepEqual(expandCustomFields(['crm.stage', 'crm.owner.name'], ['qualified', 'Aisyah']), {
      crm: { stage: 'qualified', owner: { name: 'Aisyah' } },
    });
  });

  it('keeps keys the patch did not mention', () => {
    const existing = { crm: { stage: 'new', source: 'ads' }, plan: 'growth' };
    const merged = applyCustomFields(existing, ['crm.stage'], ['qualified']);

    assert.deepEqual(merged, { crm: { stage: 'qualified', source: 'ads' }, plan: 'growth' });
  });

  it('counts tags across contacts, most frequent first', () => {
    assert.deepEqual(summarizeTags(fixtures.SAMPLE_CONTACTS), { vip: 2, apac: 2 });
  });
});

describe('templateRender', () => {
  it('fills placeholders from the variables map', () => {
    assert.equal(
      renderTemplate('Hi {name}, your order {order_id} shipped.', { name: 'Chen', order_id: 'A-91' }),
      'Hi Chen, your order A-91 shipped.'
    );
  });

  it('leaves unknown placeholders untouched', () => {
    assert.equal(renderTemplate('Hi {name}, ref {missing}.', { name: 'Chen' }), 'Hi Chen, ref {missing}.');
  });

  it('derives contact variables', () => {
    assert.equal(
      renderForContact('Hi {first_name} on {channel}', { name: 'Aisyah Rahman', channel: 'whatsapp' }),
      'Hi Aisyah on whatsapp'
    );
  });

  it('lists the slots a template needs', () => {
    assert.deepEqual(placeholders('Hi {name}, ref {order_id} / {name}'), ['name', 'order_id']);
  });
});

describe('analytics', () => {
  it('counts conversations per stage', () => {
    const rows = [
      { id: '1', status: 'new' },
      { id: '2', status: 'assigned' },
      { id: '3', status: 'resolved' },
      { id: '4', status: 'resolved' },
    ];

    const result = funnel(rows);

    assert.equal(result.total, 4);
    assert.equal(result.stages.resolved, 2);
    assert.equal(result.stages.engaged, 0);
    assert.equal(result.conversion_rate, 0.5);
  });

  it('buckets inbound-to-outbound gaps', () => {
    const result = responseTimes([
      { direction: 'inbound', created_at: '2026-01-01T10:00:00Z' },
      { direction: 'outbound', created_at: '2026-01-01T10:03:00Z' },
      { direction: 'inbound', created_at: '2026-01-01T11:00:00Z' },
      { direction: 'outbound', created_at: '2026-01-01T13:30:00Z' },
    ]);

    assert.equal(result.samples, 2);
    assert.equal(result.buckets['<=5m'], 1);
    assert.equal(result.buckets['<=240m'], 1);
  });
});
