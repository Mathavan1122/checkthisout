'use strict';

const Joi = require('joi');

const { SUPPORTED_CHANNELS } = require('../constants');

const contactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  phone: Joi.string().trim().max(20).allow(null, ''),
  email: Joi.string().trim().email().max(200).allow(null, ''),
  channel: Joi.string().valid(...SUPPORTED_CHANNELS).default('whatsapp'),
  tags: Joi.array().items(Joi.string().trim().max(40)).max(25).default([]),
});

const outboundMessageSchema = Joi.object({
  conversation_id: Joi.string().uuid().required(),
  channel: Joi.string().valid(...SUPPORTED_CHANNELS).required(),
  template: Joi.string().max(2000).required(),
  variables: Joi.object().pattern(/^[a-zA-Z0-9_]{1,40}$/, Joi.string().max(500)).default({}),
});

const webhookSchema = Joi.object({
  url: Joi.string().uri({ scheme: ['https'] }).max(400).required(),
  events: Joi.array().items(Joi.string().max(60)).min(1).max(20).required(),
});

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const err = new Error(error.details.map((d) => d.message).join('; '));
    err.status = 400;
    err.code = 'validation_failed';
    err.expose = true;
    throw err;
  }

  return value;
}

// Integers arriving as query strings. Anything non-numeric collapses to the
// default so the value can never leave this function as attacker-controlled.
function boundedInt(raw, { min, max, fallback }) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

module.exports = {
  validate,
  boundedInt,
  contactSchema,
  outboundMessageSchema,
  webhookSchema,
};
