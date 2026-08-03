# Master Findings List — convo-hub-api v1.4.2

All findings from vulnerability assessment, license review, and SAST — ranked by fix priority.

| Rank | ID | Source | File & Line | Severity | Finding | Fix |
|------|----|--------|-------------|----------|---------|-----|
| 1 | V-01 | Vuln | `src/routes/contacts.js:35–44` | **Critical** | SQL injection — raw string interpolation of `req.query.workspaceId` and `req.query.name` directly into SQL query | Parameterise query (see patch) |
| 2 | V-02 | Vuln | `src/services/contactMerge.js:8` / `src/routes/contacts.js:71` | **High** | Prototype pollution — `_.zipObjectDeep(paths, values)` + `_.merge` with unsanitised user-supplied path strings | Sanitise paths; bump lodash to 4.18.1 |
| 3 | L-01 | License | `package.json` | **High** | `jszip@3.10.1` dual-licensed MIT/GPL-3.0 — GPL arm is live and incompatible with closed-source SaaS | Replace with `fflate` (MIT) |
| 4 | S-01 | SAST | `src/middleware/auth.js:24` | **High** | JWT `none` algorithm on unsigned mesh-sidecar path — safe only if `x-mesh-peer` header is stripped at ingress; unconfirmed | Confirm infra control; document or add defence-in-depth |
| 5 | V-03 | Vuln | `package.json` | **Low** | `mkdirp@0.5.1` → `minimist≤0.2.3` prototype pollution (CVSS 9.8) — not reachable, `mkdirp.sync` called once at startup with hardcoded path | Bump mkdirp to 0.5.6 (no code change) |
| 6 | L-02 | License | `package.json` | **Low** | `dotenv@17.4.2` changed license from MIT to BSD-2-Clause — permissive, but needs one-time legal sign-off | Add to license allowlist with ticket reference |
| 7 | S-02 | SAST | `src/routes/media.js:50` | **Info** | Path traversal flagged on `path.join` — false positive; BLOB_ID regex `/^[0-9a-f]{16}$/` blocks all traversal payloads | Add `nosemgrep` comment; no code change |
| 8 | S-03 | SAST | `src/routes/media.js:57` | **Info** | XSS flagged on `res.send()` — false positive; response typed `application/octet-stream`, no HTML surface | Add `nosemgrep` comment; no code change |

---

## Notes on ranking

**V-01 (SQL injection) is ranked above V-02 (prototype pollution)** because it is unauthenticated — the `/search` route uses `req.query.workspaceId` which is entirely attacker-controlled with no auth check visible in the route, and the query is built by direct string interpolation. An anonymous attacker can dump the entire contacts table. Prototype pollution requires a valid authenticated session.

**S-01 (JWT none-alg)** is ranked high because the risk is conditional on an infrastructure control that has not been confirmed in code review. If the `x-mesh-peer` header is not stripped at the ingress, this is a critical authentication bypass. It stays high until the infra control is verified and documented.

**V-03 (minimist)** carries a CVSS 9.8 but ranks low because the vulnerable code path is provably unreachable — mkdirp is called once at startup with a constant path. The fix is a one-line version bump and should be done anyway, but it is not a live risk.