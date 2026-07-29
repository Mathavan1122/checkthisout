'use strict';

const DIGITS_ONLY = /[^0-9]/g;

// Very small E.164 normaliser. The platform only onboards workspaces in a
// handful of countries, so a full parsing library is overkill here.
const DEFAULT_COUNTRY_PREFIX = {
  MY: '60',
  SG: '65',
  ID: '62',
  PH: '63',
  IN: '91',
};

function normalizeE164(raw, country = 'MY') {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(DIGITS_ONLY, '');
  if (digits.length === 0) return null;

  if (!hadPlus) {
    const prefix = DEFAULT_COUNTRY_PREFIX[country];
    if (!prefix) return null;
    digits = digits.replace(/^0+/, '');
    digits = `${prefix}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function isE164(value) {
  return typeof value === 'string' && /^\+[1-9][0-9]{7,14}$/.test(value);
}

module.exports = { normalizeE164, isE164 };
