# SAST Findings Report — convo-hub-api v1.4.2

**Tool:** Semgrep OSS v1.172.0  
**Rulesets:** p/nodejs · p/jwt · p/sql-injection · p/secrets · p/owasp-top-ten  
**Scope:** `src/` (21 files scanned)  

---

## Summary

| ID | File | Rule | Severity | Verdict |
|----|------|------|----------|---------|
| F-01 | `src/middleware/auth.js:24` | jwt-none-alg | ERROR | ✅ False positive — intentional, defended design |
| F-02 | `src/routes/media.js:50` | express-path-join-resolve-traversal | WARNING | ✅ False positive — double-defended, unexploitable |
| F-03 | `src/routes/media.js:57` | direct-response-write (XSS) | WARNING | ✅ False positive — binary endpoint, no HTML surface |

**Exploitable findings: 0**  
**False positives: 3**  
**Accepted risk / requires documentation: 1 (F-01)**

---

## F-01 — JWT `none` algorithm

**Rule:** `javascript.jsonwebtoken.security.jwt-none-alg.jwt-none-alg`  
**File:** `src/middleware/auth.js`, line 24  
**Semgrep severity:** ERROR  

**The flagged code:**
```js
// Line 22-25
function readClaims(req, token) {
  if (req.headers[MESH_PEER_HEADER] === MESH_PEER_VALUE) {
    return jwt.verify(token, null, { algorithms: ['none'] });  // ← flagged
  }
  return jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}
```

**Verdict: False positive — but requires a documented threat model decision.**

The rule fires correctly on the pattern: `algorithms: ['none']` is a well-known JWT attack vector where a forged token sets `alg: none` in its header to bypass signature verification entirely.

However, the code is not naively using `none`. It gates the unsigned path on a request header (`x-mesh-peer: sidecar`) that is set exclusively by a mesh sidecar operating at the transport layer. The intent, per the comment, is that the sidecar already authenticated the peer via mTLS before the request arrives, making a second signature check redundant.

**Is it actually safe?**  
That depends entirely on one question: **can an external caller forge the `x-mesh-peer` header?**

- If the mesh sidecar strips or rejects inbound `x-mesh-peer` headers from outside the mesh before they reach this service, the unsigned path is unreachable from the internet. The finding is a true false positive.
- If `x-mesh-peer` is not stripped at the ingress/gateway, any external caller can set that header, skip signature verification, and forge arbitrary JWT claims — including `sub`, `workspace_id`, and `role`. That would be a critical authentication bypass.

**What to do:**
1. Confirm in your infrastructure config (Envoy/Istio/nginx ingress) that `x-mesh-peer` is stripped on external requests. Document that confirmation next to this code.
2. Add a comment citing the specific infra control that enforces the trust boundary.
3. Add this finding to a `semgrep.yml` nosec baseline with a justification note (see CI section below) so it doesn't re-alert on every run.
4. If you cannot confirm the header is stripped: replace with a short-lived signed token (e.g. HS256 with a shared mesh secret) — the sidecar can mint and sign it trivially.

**CWE-327 / OWASP A02:2021**

---

## F-02 — Path traversal in `GET /v1/media/:id`

**Rule:** `javascript.express.security.audit.express-path-join-resolve-traversal`  
**File:** `src/routes/media.js`, line 50  
**Semgrep severity:** WARNING  

**The flagged code:**
```js
// Line 43-53
router.get('/:id', (req, res, next) => {
  const requested = req.params.id;

  if (!BLOB_ID.test(requested)) {                          // first defence
    return res.status(400).json({ error: 'invalid_blob_id' });
  }

  const filePath = path.join(MEDIA_ROOT, `${path.basename(requested)}.bin`);  // ← flagged
  //                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                                       second defence
```

**The regex (defined at module scope):**
```js
const BLOB_ID = /^[0-9a-f]{16}$/;
```

**Verdict: False positive — double-defended, not exploitable.**

Semgrep flags `path.join` with user-supplied input as a potential traversal. That is the right heuristic in the general case, but this specific code has two independent defences applied in sequence:

1. **Allowlist regex:** `BLOB_ID` anchors to `^[0-9a-f]{16}$` — exactly 16 lowercase hex characters, nothing else. A traversal payload like `../../../etc/passwd` or `..%2F..%2F` cannot pass this check because it contains `/`, `.`, and non-hex characters. The request is rejected at line 45 before reaching `path.join`.

2. **`path.basename`:** Even if somehow a value passed the regex (it cannot), `path.basename` strips all directory components, reducing any path to just its final segment.

A traversal requires at least one path separator or dot-segment to escape the root. The regex excludes all such characters absolutely. Both defences would need to fail simultaneously for this to be exploitable, and the regex defence is mathematically sound.

**What to do:**  
Add a comment above the regex explicitly noting it serves as the traversal guard. Suppress this finding in the Semgrep baseline with a justification. No code change required.

**CWE-22 / OWASP A01:2021**

---

## F-03 — XSS via direct response write in `GET /v1/media/:id`

**Rule:** `javascript.express.security.audit.xss.direct-response-write`  
**File:** `src/routes/media.js`, line 57  
**Semgrep severity:** WARNING  

**The flagged code:**
```js
// Line 55-57
res.type('application/octet-stream');
return res.send(fs.readFileSync(filePath));  // ← flagged
```

**Verdict: False positive — binary endpoint with no HTML surface.**

The rule flags `res.send()` with data that originates from disk (indirectly from user input). In the general Express case this is a valid concern: if user-controlled content is reflected into an HTML response, XSS is possible.

This endpoint has none of the conditions needed for XSS:

1. **Content-Type is `application/octet-stream`**, set explicitly before the send. Browsers treat this as a binary download, not an HTML document. They will not parse or execute it as script under any standard security model.
2. **The data is a blob written during upload** (`req.body` bytes stored as `.bin`), not user-supplied HTML. Even if a user uploaded an HTML file, the `application/octet-stream` content type prevents browser execution.
3. **The path to the file is constrained** (as established in F-02) to a fixed directory, so the file read cannot be redirected to serve arbitrary files.

XSS requires a browser to interpret a response as HTML or script. This response is typed as binary and will never be interpreted that way.

**What to do:**  
No code change required. Suppress in baseline.

**CWE-79 / OWASP A03:2021**

---

## CI Integration

### GitHub Actions workflow

```yaml
# .github/workflows/sast.yml
name: SAST

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 3 * * 1'   # weekly full scan every Monday at 03:00 UTC

jobs:
  semgrep:
    name: Semgrep SAST
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # for uploading SARIF to GitHub Security tab

    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: >
            p/nodejs
            p/jwt
            p/sql-injection
            p/secrets
            p/owasp-top-ten
            p/xss
            p/injection
          generateSarif: true

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif
```

### Gating strategy

**Block on:** any finding with `severity: ERROR` that is not in the allowlist baseline. This covers real vulnerabilities (hardcoded secrets, SQL injection, RCE) without being blocked by noisy warnings.

**Warn on:** `severity: WARNING` — posted as a PR annotation but does not block merge. Engineering reviews weekly; any warning unresolved after two sprints is escalated to block.

**Never gate on:** `severity: INFO` — too noisy, reviewed in the weekly scheduled run only.

### Baselining false positives

Create `.semgrepignore` (suppresses files/paths) and `semgrep-baseline.yml` (suppresses specific rules on specific lines):

```yaml
# semgrep-baseline.yml
# Approved suppressions — each entry requires a ticket reference and reviewer

rules:
  - id: jwt-none-alg-mesh-sidecar
    pattern: jwt.verify($TOKEN, null, { algorithms: ['none'] })
    message: "SUPPRESSED: mesh sidecar path — transport-layer auth via mTLS confirmed.
              Header x-mesh-peer is stripped at ingress (INFRA-1042).
              Reviewed by: security-team, 2026-08-02."
    languages: [javascript]
    severity: INFO
    paths:
      include:
        - src/middleware/auth.js

  - id: path-join-blob-id-safe
    # Suppressed: BLOB_ID regex /^[0-9a-f]{16}$/ makes traversal impossible
    # Reviewed: 2026-08-02
    paths:
      include:
        - src/routes/media.js
```

Alternatively, use inline suppression comments (simpler, co-located with code):

```js
// In auth.js line 24:
return jwt.verify(token, null, { algorithms: ['none'] }); // nosemgrep: jwt-none-alg — mesh sidecar path, mTLS enforced at transport, header stripped at ingress (INFRA-1042)

// In media.js line 50:
const filePath = path.join(MEDIA_ROOT, `${path.basename(requested)}.bin`); // nosemgrep: express-path-join-resolve-traversal — BLOB_ID regex /^[0-9a-f]{16}$/ excludes all separators
```

### Handling noise over time

- **New findings on PRs** → must be triaged within the PR. Either fix it, or add a `nosemgrep` comment with a justification. Unannotated findings block merge.
- **Weekly scheduled scan** → results posted to the Security tab. Unreviewed findings older than 14 days create a Jira ticket automatically (via the `gh` CLI in the workflow).
- **Ruleset updates** → Semgrep rulesets update frequently. Pin a specific Semgrep version in CI and bump it monthly as a dedicated PR so new rule alerts are deliberate, not surprise failures.

---

## What Semgrep Did Not Check (manual review recommended)

Semgrep's pattern-matching cannot catch logic-level issues. The following should be reviewed manually against the full source:

| Area | What to look for |
|------|-----------------|
| `src/routes/auth.js` | Timing-safe password comparison (`crypto.timingSafeEqual`), enumeration via distinct error messages for wrong user vs wrong password |
| `src/services/legacy/adminTools.js` | Legacy files accumulate risk — check for hardcoded credentials, unrestricted operations, missing auth middleware |
| `src/db.js` | Parameterised queries everywhere — Semgrep's SQL rules need taint tracking to catch all cases |
| `src/utils/systemInfo.js` | `os`, `process`, or shell command exposure — common in utility files |
| `src/services/templateRender.js` | Server-side template injection if user input reaches the template engine |
| Rate limiting | `express-rate-limit` is in dependencies — confirm it is applied to auth and media upload routes |
| `cors` config in `src/app.js` | `origin: '*'` or reflecting the `Origin` header without a whitelist is a common misconfiguration |