'use strict';

const _ = require('lodash');

// Custom fields arrive from the inbox UI as parallel arrays of dotted paths and
// values, e.g. paths = ['crm.stage', 'crm.owner.name'] with values =
// ['qualified', 'Aisyah']. They are expanded into the nested object we persist
// alongside the contact record.
function expandCustomFields(paths, values) {
  return _.zipObjectDeep(paths, values);
}

// Applies an expanded custom-field patch on top of whatever the contact already
// has stored, keeping any key the caller did not mention.
function applyCustomFields(existing, paths, values) {
  const patch = expandCustomFields(paths, values);
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

module.exports = { expandCustomFields, applyCustomFields, summarizeTags };
