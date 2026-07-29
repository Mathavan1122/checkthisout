# Tests

`npm test` runs the unit and route tests on the Node test runner. None of them
need a database or network access — the suites cover the pure helpers plus the routes that
respond before any query is issued.

`fixtures.js` holds sample records and placeholder credentials. The signing key
there exists only so the tests can mint a token for the auth middleware, and the
api-key/token strings are shaped like the real thing purely so the validators
under test have realistic input. None of them are provisioned anywhere.
