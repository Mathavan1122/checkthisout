'use strict';

// Layers a defaults map underneath whatever is already present in
// process.env and hands back the merged view. Anything the process
// environment defines always wins.

function load(options) {
  const opts = options || {};
  const defaults = opts.defaults || {};
  const required = opts.required || [];

  const merged = {};

  Object.keys(defaults).forEach((key) => {
    merged[key] = defaults[key];
  });

  Object.keys(process.env).forEach((key) => {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      merged[key] = value;
    }
  });

  const missing = required.filter((key) => merged[key] === undefined || merged[key] === '');
  if (missing.length > 0) {
    throw new Error('dotenv-extened: missing required keys: ' + missing.join(', '));
  }

  return merged;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return Boolean(fallback);
  return ['1', 'true', 'yes', 'on'].indexOf(String(value).toLowerCase()) !== -1;
}

module.exports = { load: load, bool: bool };
