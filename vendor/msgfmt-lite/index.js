'use strict';

// A {placeholder} formatter small enough to audit in one sitting. Substitution
// is a plain string replace: no expressions are compiled or evaluated, and a
// placeholder with no matching variable is left in the output untouched so the
// gap is visible rather than silently blank.

var PLACEHOLDER = /\{([A-Za-z0-9_]{1,40})\}/g;

function format(template, variables) {
  var vars = variables || {};

  if (typeof template !== 'string') return '';

  return template.replace(PLACEHOLDER, function (match, name) {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;

    var value = vars[name];
    if (value === null || value === undefined) return match;

    return String(value);
  });
}

function placeholders(template) {
  if (typeof template !== 'string') return [];

  var found = [];
  var match;

  PLACEHOLDER.lastIndex = 0;
  while ((match = PLACEHOLDER.exec(template)) !== null) {
    if (found.indexOf(match[1]) === -1) found.push(match[1]);
  }

  return found;
}

module.exports = {
  format: format,
  placeholders: placeholders,
};
