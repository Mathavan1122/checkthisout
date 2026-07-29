-- convo-hub-api schema.
--
-- Loaded automatically by the compose stack (see docker-compose.yml). To apply
-- it by hand against an existing database:
--
--   psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id          bigint PRIMARY KEY,
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'growth',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   bigint NOT NULL REFERENCES workspaces (id),
  email          text NOT NULL UNIQUE,
  role           text NOT NULL DEFAULT 'agent',
  password_hash  text NOT NULL,
  disabled_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   bigint NOT NULL REFERENCES workspaces (id),
  name           text NOT NULL,
  phone          text,
  email          text,
  channel        text NOT NULL DEFAULT 'whatsapp',
  tags           text[] NOT NULL DEFAULT '{}',
  custom_fields  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     bigint NOT NULL REFERENCES workspaces (id),
  contact_id       uuid NOT NULL REFERENCES contacts (id),
  subject          text,
  status           text NOT NULL DEFAULT 'new',
  channel          text NOT NULL DEFAULT 'whatsapp',
  last_message_at  timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations (id),
  direction        text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel          text NOT NULL,
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  bigint NOT NULL REFERENCES workspaces (id),
  url           text NOT NULL,
  events        text[] NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_workspace_created_idx ON contacts (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_workspace_updated_idx ON contacts (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_workspace_last_msg_idx ON conversations (workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhooks_workspace_idx ON webhooks (workspace_id);

-- ---------------------------------------------------------------------------
-- Development fixtures. Two workspaces so that workspace scoping can be
-- exercised locally. The passwords below are for local development only.
--   aisyah@example.com / agent-password-123   (role: agent, workspace 4417)
--   owner@example.com  / owner-password-123   (role: owner, workspace 4417)
--   dana@example.com   / agent-password-123   (role: agent, workspace 8802)
-- ---------------------------------------------------------------------------

INSERT INTO workspaces (id, name, plan) VALUES
  (4417, 'Northwind Retail', 'growth'),
  (8802, 'Lumen Clinics', 'enterprise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (workspace_id, email, role, password_hash) VALUES
  (4417, 'aisyah@example.com', 'agent',
   '368aeb49cd443de125b4098ef51e067d:25c8bdde7de1dc8ac1b8cc1daeeea64c6dcd6b46bfc4792e2c6eac1e550f3154689f7d40f2688a407a8374194ea2646d11631aae4b5eddec2051b72eab5da410'),
  (4417, 'owner@example.com', 'owner',
   '9cc8f413667ad2e6cd9f0f6e35ec2956:b4c90a5b7de5b6d8af2c51ef9914da40081d712413ac3891a7ddfb54f28d4332c91d51b501b083ffc373a652c842fa328f2d917bd39969919a95b597194baafb'),
  (8802, 'dana@example.com', 'agent',
   '368aeb49cd443de125b4098ef51e067d:25c8bdde7de1dc8ac1b8cc1daeeea64c6dcd6b46bfc4792e2c6eac1e550f3154689f7d40f2688a407a8374194ea2646d11631aae4b5eddec2051b72eab5da410')
ON CONFLICT (email) DO NOTHING;

WITH sample_contacts AS (
  INSERT INTO contacts (workspace_id, name, phone, email, channel, tags) VALUES
    (4417, 'Aisyah Rahman',  '+60123456789', 'aisyah.r@example.com',  'whatsapp', ARRAY['vip', 'apac']),
    (4417, 'Budi Santoso',   '+628123456789', 'budi.s@example.com',   'telegram', ARRAY['apac']),
    (4417, 'Chen Wei',       '+6591234567',  'chen.w@example.com',    'whatsapp', ARRAY['vip']),
    (8802, 'Priya Menon',    '+919812345678', 'priya.m@example.com',  'whatsapp', ARRAY['clinic', 'india'])
  RETURNING id, workspace_id, name
)
INSERT INTO conversations (workspace_id, contact_id, subject, status, channel, last_message_at)
SELECT
  workspace_id,
  id,
  'Order enquiry from ' || name,
  (ARRAY['new', 'assigned', 'engaged', 'resolved'])[1 + (row_number() OVER (ORDER BY name))::int % 4],
  'whatsapp',
  now() - (row_number() OVER (ORDER BY name)) * interval '2 hours'
FROM sample_contacts;

INSERT INTO messages (conversation_id, direction, channel, body, created_at)
SELECT c.id, 'inbound', c.channel, 'Hi, is this still available?', c.last_message_at - interval '20 minutes'
FROM conversations c;

INSERT INTO messages (conversation_id, direction, channel, body, created_at)
SELECT c.id, 'outbound', c.channel, 'Yes it is. Shall I reserve one for you?', c.last_message_at
FROM conversations c;

INSERT INTO webhooks (workspace_id, url, events) VALUES
  (4417, 'https://hooks.example.com/northwind', ARRAY['message.created', 'conversation.closed'])
ON CONFLICT DO NOTHING;

COMMIT;
