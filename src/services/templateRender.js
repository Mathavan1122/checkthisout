'use strict';

const msgfmt = require('msgfmt-lite');

// Outbound message bodies are stored as templates with {placeholder} slots that
// get filled from the conversation's contact record before the channel adapter
// sends them.
function renderTemplate(template, variables) {
  return msgfmt.format(template, variables || {});
}

function renderForContact(template, contact, extra = {}) {
  return renderTemplate(template, {
    name: contact.name || 'there',
    first_name: String(contact.name || 'there').split(' ')[0],
    channel: contact.channel || 'whatsapp',
    ...extra,
  });
}

function placeholders(template) {
  return msgfmt.placeholders(template);
}

module.exports = { renderTemplate, renderForContact, placeholders };
