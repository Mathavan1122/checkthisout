'use strict';

// Values in this file are compile-time constants for the service. They are not
// read from the environment or from any request.

// Executable used by the /health endpoint to report which runtime is serving
// traffic. Kept here so the platform team can swap it during a runtime upgrade.
const RUNTIME_PROBE = 'node';

// Directory (relative to the app root) where uploaded media blobs are written.
const MEDIA_DIRNAME = 'var/media';

// Columns the conversations list endpoint is allowed to sort on.
const SORTABLE_CONVERSATION_COLUMNS = ['created_at', 'updated_at', 'last_message_at', 'subject'];

// Channels this service knows how to route outbound messages to.
const SUPPORTED_CHANNELS = ['whatsapp', 'telegram', 'facebook', 'sms', 'email'];

module.exports = {
  RUNTIME_PROBE,
  MEDIA_DIRNAME,
  SORTABLE_CONVERSATION_COLUMNS,
  SUPPORTED_CHANNELS,
};
