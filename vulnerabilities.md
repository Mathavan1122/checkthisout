# Software Supply Chain Security Assessment
**Application:** convo-hub-api v1.4.2  
**Assessment Date:** 2026-08-01  
**Assessor:** Mathavan Krishnan

---

## Methodology

This assessment goes beyond running `npm audit` and pasting results. Each flagged dependency was traced through the actual application source code to determine whether a vulnerable code path is reachable from an attacker-controlled input. HTTP endpoints were tested against a running instance to confirm exploitability where possible.

Tools used: `npm audit`, manual source code review, live HTTP testing against `http://localhost:3000`.

---

## Dependency Inventory

The application declares 17 production dependencies. Total dependency tree (prod + dev + optional): 171 packages.

Three packages were flagged by `npm audit`: `lodash` (direct), `mkdirp` (direct), and `minimist` (transitive via mkdirp). In addition, three local vendor packages (`convo-insights`, `dotenv-extened`, `msgfmt-lite`) are installed via `file:` references and are invisible to `npm audit` entirely. These were noted but are outside the scope of this assessment.

---

## Findings

### Finding 1 — Prototype Pollution via lodash
**Package:** lodash 4.17.15  
**Type:** Direct dependency  
**CVEs:** GHSA-p6mc-m468-83gw (CVSS 7.4), GHSA-f23m-r3pf-42rh (CVSS 6.5), GHSA-xxjr-mmjv-4gpg (CVSS 6.5)  
**Fix available:** lodash 4.18.1 (non-breaking)  
**Actual risk:** Medium  
**Confirmed exploitable:** Yes, for authenticated users only  

#### Vulnerability description

Multiple lodash versions below 4.17.21 and all versions up to 4.17.23 are vulnerable to prototype pollution through functions including `_.merge`, `_.zipObjectDeep`, `_.defaultsDeep`, `_.set`, `_.unset`, and `_.omit`. An attacker who can control the keys passed to these functions can set properties on `Object.prototype`, affecting all objects in the Node.js process.

#### Code path analysis

`src/services/contactMerge.js` exposes `applyCustomFields` which is called directly by `PATCH /v1/contacts/:id/custom-fields`:

```js
function expandCustomFields(paths, values) {
  return _.zipObjectDeep(paths, values);
}

function applyCustomFields(existing, paths, values) {
  const patch = expandCustomFields(paths, values);
  return _.merge({}, existing || {}, patch);
}
```

In `routes/contacts.js`, `paths` and `values` are taken directly from `req.body` with no sanitisation on the path strings themselves:

```js
const paths = Array.isArray(req.body.paths) ? req.body.paths : [];
const values = Array.isArray(req.body.values) ? req.body.values : [];
```

The only validation is a length check. The actual string content of each path is passed untouched into `_.zipObjectDeep`. A malicious payload such as:

```json
{
  "paths": ["__proto__.polluted"],
  "values": ["hacked"]
}
```

would cause `_.zipObjectDeep` to construct `{ __proto__: { polluted: "hacked" } }`, which `_.merge` then applies, polluting `Object.prototype` for the entire process.

#### Attack surface

The endpoint sits behind `requireUser` middleware. Authentication requires a valid email and password — there is no open registration route. This limits the attack surface to authenticated users only. An anonymous external attacker cannot reach this endpoint without valid credentials.

Realistic threat actors: compromised user account, malicious insider.

Because exploitation requires authentication and there is no open registration, the practical risk is rated **medium** rather than high. The vulnerability is real and the code path is confirmed, but an anonymous external attacker cannot reach it directly.

#### Impact

Successful prototype pollution can lead to application logic bypass, privilege escalation (if role checks rely on object property lookups), or denial of service depending on what properties are polluted.

#### Remediation

Bump lodash to 4.18.1. Additionally, sanitise path strings in `applyCustomFields` to reject any path segment starting with `__proto__`, `constructor`, or `prototype` before passing to lodash functions.

---

### Finding 2 — Transitive Prototype Pollution via minimist (mkdirp)
**Packages:** mkdirp 0.5.1 (direct) → minimist <=0.2.3 (transitive)  
**CVEs:** GHSA-xvch-5gv4-984h (CVSS 9.8), GHSA-vh95-rmgr-6w4m (CVSS 5.6)  
**Fix available:** mkdirp 0.5.6 (non-breaking)  
**Confirmed exploitable:** No  

#### Vulnerability description

minimist versions below 0.2.4 are vulnerable to prototype pollution when parsing attacker-controlled command line arguments. npm audit rates this critical (CVSS 9.8) because the raw CVE score assumes attacker-controlled input reaches the parser.

#### Code path analysis

`src/routes/media.js` is the only file that imports `mkdirp`:

```js
mkdirp.sync(MEDIA_ROOT);
```

`MEDIA_ROOT` is constructed entirely from hardcoded values:

```js
const MEDIA_ROOT = path.resolve(__dirname, '..', '..', MEDIA_DIRNAME);
```

`MEDIA_DIRNAME` is a constant. `mkdirp` is called once at server startup with a fixed path. No user input, request data, or external values ever reach this call. The vulnerable `minimist` code path inside `mkdirp` is never triggered at runtime.

#### Risk verdict

Despite the CVSS 9.8 score, this finding carries **low practical risk** in this application. The vulnerable function is never called with attacker-controlled input. The high score reflects the worst-case scenario for the CVE generically, not the actual exposure here.

#### Remediation

Bump mkdirp to 0.5.6. This pulls in minimist 0.2.4+ and resolves the transitive vulnerability. The fix requires no code changes and carries no breaking changes.

---

## Summary

| # | Package | CVE | npm severity | Actual risk | Exploitable | Fix |
|---|---------|-----|-------------|-------------|-------------|-----|
| 1 | lodash 4.17.15 | GHSA-p6mc et al | High | Medium | Yes (authenticated only) | Bump to 4.18.1 |
| 2 | mkdirp → minimist | GHSA-xvch | Critical | Low | No | Bump mkdirp to 0.5.6 |

The most important takeaway is the inversion between npm's severity ratings and real-world risk. The package npm labels critical (minimist, CVSS 9.8) is not exploitable in this application because the vulnerable code path is never reached. The package npm labels high (lodash) is downgraded to medium because while user-controlled input directly reaches the vulnerable functions, exploitation requires valid credentials — there is no open registration and no anonymous access to the affected endpoint.

---

## Remediation Commands

```bash
npm install lodash@4.18.1
npm install mkdirp@0.5.6
```

Or run `npm audit fix` which will resolve both automatically as neither fix is a major version bump.