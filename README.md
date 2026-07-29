# convo-hub-api

Contact and conversation API behind the agent inbox. It owns contact records,
conversation state, outbound message queueing, media blobs, workspace webhooks
and the dashboard reporting endpoints.

## Running locally

```bash
npm install
cp .env.example .env
npm start
```

The process boots without a database attached — `pg` opens a connection on the
first query, so `/health` and the auth failure paths respond immediately. Routes
that read or write data need Postgres reachable at the `PG*` values in `.env`.

```bash
npm test
```

The test suite needs no database and no network — it exercises the pure helpers
and the routes that respond before any query runs.

## Database (optional)

You do not need a database to build the service, run the tests, or read the
code. Bring one up only if you want to exercise the data routes.

```bash
docker compose up -d          # postgres:16-alpine, schema + fixtures auto-loaded
cp .env.example .env          # PG* values already match the compose service
npm start
```

`db/schema.sql` defines the tables and loads a small set of development fixtures
across two workspaces. The local development logins are listed at the top of
that file. To apply the schema against an existing database instead:

```bash
psql "postgresql://convo_hub:convo_hub_local@localhost:5432/convo_hub" -f db/schema.sql
```

## Layout

```
src/
  app.js            express wiring, middleware order, error handler
  server.js         listener + graceful shutdown
  config.js         environment -> config object
  constants.js      compile-time constants
  db.js             pg connection pool
  middleware/       auth (access token -> req.user), role guard
  routes/           one router per resource, mounted under /v1
  services/         business logic used by the routers
  utils/            phone normalisation, request validation, runtime info
tests/              unit and route suites (no database or network required)
db/                 schema.sql (tables + local fixtures)
vendor/             packages installed from the local tree
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health`, `/health/ready` | unauthenticated |
| POST | `/v1/auth/token` | email + password, returns a bearer token |
| GET | `/v1/contacts` | paginated, workspace-scoped |
| GET | `/v1/contacts/search` | inbox free-text search |
| POST | `/v1/contacts` | create |
| PATCH | `/v1/contacts/:id/custom-fields` | dotted-path custom field patch |
| GET | `/v1/contacts/tag-summary` | tag frequencies |
| GET | `/v1/conversations` | sortable list |
| GET | `/v1/conversations/:id` | single conversation |
| POST | `/v1/conversations/:id/close` | close |
| GET | `/v1/messages` | conversation history |
| POST | `/v1/messages` | queue an outbound templated message |
| POST | `/v1/messages/template/preview` | render a draft template |
| POST | `/v1/media` | upload a blob (`application/octet-stream`) |
| GET | `/v1/media/:id` | fetch a blob |
| GET / POST | `/v1/webhooks` | list / register a receiver |
| POST | `/v1/webhooks/test-delivery` | fire a sample event at a receiver |
| GET | `/v1/reports/funnel` | 30-day funnel |
| GET | `/v1/reports/response-times` | response-time histogram |
| GET | `/v1/reports/export.zip` | admin-only bulk export |

All `/v1` routes except `/v1/auth/token` require `Authorization: Bearer <token>`.

## Container

```bash
docker build -t convo-hub-api .
docker run --rm -p 3000:3000 --env-file .env convo-hub-api
```
