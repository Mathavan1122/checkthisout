'use strict';

const _ = require('lodash');

// Segments that would pollute Object.prototype if passed to lodash's deep-path
// functions. These must be rejected before any _.zipObjectDeep / _.merge call.
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Returns true if a dotted path string contains a segment that could be used
 * for prototype pollution. Called before lodash touches the paths array.
 *
 * Examples that are blocked:
 *   "__proto__.polluted"
 *   "a.constructor.b"
 *   "prototype"
 *   "a.__proto__"
 */
function isDangerousPath(p) {
  if (typeof p !== 'string') return true; // non-strings are always rejected
  return p.split('.').some((seg) => DANGEROUS_SEGMENTS.has(seg));
}

/**
 * Filters out any paths that could pollute Object.prototype and returns the
 * safe subset along with the corresponding values (keeping the arrays aligned).
 */
function sanitisePaths(paths, values) {
  const safePaths = [];
  const safeValues = [];
  for (let i = 0; i < paths.length; i++) {
    if (!isDangerousPath(paths[i])) {
      safePaths.push(paths[i]);
      safeValues.push(values[i]);
    }
  }
  return { paths: safePaths, values: safeValues };
}

// Custom fields arrive from the inbox UI as parallel arrays of dotted paths and
// values, e.g. paths = ['crm.stage', 'crm.owner.name'] with values =
// ['qualified', 'Aisyah']. They are expanded into the nested object we persist
// alongside the contact record.
function expandCustomFields(paths, values) {
  return _.zipObjectDeep(paths, values);
}

// Applies an expanded custom-field patch on top of whatever the contact already
// has stored, keeping any key the caller did not mention.
// Paths are sanitised before lodash sees them to prevent prototype pollution
// via __proto__, constructor, or prototype path segments.
function applyCustomFields(existing, paths, values) {
  const safe = sanitisePaths(paths, values);
  const patch = expandCustomFields(safe.paths, safe.values);
  return _.merge({}, existing || {}, patch);
}

function summarizeTags(contacts) {
  return _(contacts)
    .flatMap((c) => c.tags || [])
    .countBy()
    .toPairs()
    .orderBy([1], ['desc'])
    .take(20)
    .fromPairs()
    .value();
}

module.exports = {
  expandCustomFields,
  applyCustomFields,
  summarizeTags,
  isDangerousPath,   // exported for unit testing
  sanitisePaths,     // exported for unit testing
};