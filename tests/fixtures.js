'use strict';

// Fixture data for the unit tests. Nothing in this file is used by src/ and
// none of these strings exist in any deployed environment: the signing key is
// generated for the test process only, and the api key / token below are
// syntactically valid placeholders so the parsers under test have something to
// chew on. See tests/README.md.

// Signing key the tests use to mint tokens for the auth middleware.
const TEST_JWT_SECRET = 'jest-local-signing-key-not-a-real-secret';

// Placeholder credential shaped like a provider key, used to assert that the
// webhook payload validator rejects unknown fields.
const SAMPLE_PROVIDER_API_KEY = 'sk_test_0000000000000000000000000000000000000000';

// Placeholder bearer token used by the "malformed token" assertions.
const SAMPLE_MALFORMED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.bm90LWEtcmVhbC1wYXlsb2Fk.c2lnbmF0dXJl';

const SAMPLE_WORKSPACE_ID = 4417;
const SAMPLE_USER_ID = '22222222-2222-4222-8222-222222222222';

const SAMPLE_CONTACTS = [
  { id: 'c1', name: 'Aisyah Rahman', channel: 'whatsapp', tags: ['vip', 'apac'] },
  { id: 'c2', name: 'Budi Santoso', channel: 'telegram', tags: ['apac'] },
  { id: 'c3', name: 'Chen Wei', channel: 'whatsapp', tags: ['vip'] },
];

module.exports = {
  TEST_JWT_SECRET,
  SAMPLE_PROVIDER_API_KEY,
  SAMPLE_MALFORMED_TOKEN,
  SAMPLE_WORKSPACE_ID,
  SAMPLE_USER_ID,
  SAMPLE_CONTACTS,
};
