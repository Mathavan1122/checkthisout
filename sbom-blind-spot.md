# SBOM — Blind Spots & Limitations

**Format:** CycloneDX JSON  
**Generator:** @cyclonedx/cyclonedx-npm v6.0.0 

---

## What the SBOM covers

- All 142 npm-resolved production packages with name, version, purl, and declared SPDX license
- The three vendor packages (`convo-insights`, `dotenv-extened`, `msgfmt-lite`) appear by name and version — the tool picked them up from `node_modules` after `npm install`
- Dependency relationships (component dependencies graph)

---

## What the SBOM misses

### 1. Vendor package internals — most important gap

The three `file:./vendor/*` packages appear in the SBOM with a name and version, but **their own dependency trees are not resolved**. If `convo-insights` bundles its own copy of lodash, axios, or any other library, those transitive deps are invisible to both the SBOM and `npm audit`. The SBOM gives false confidence that vendor packages are fully inventoried when only their top-level entry is recorded.

**Fix:** Vendor packages should either be published to a private npm registry (so the resolver can walk their deps normally), or their `package.json` and `package-lock.json` should be committed to the repo and scanned separately.

### 2. License data for vendor packages is absent

The SBOM records `convo-insights@0.7.1`, `dotenv-extened@2.9.4`, and `msgfmt-lite@1.3.0` but carries no license field for any of them — the tool cannot infer a license from a local directory without a properly declared `license` field in the package's own `package.json`. From a compliance standpoint these three packages have **no license** as far as the SBOM is concerned.

### 3. Runtime environment is not captured

The SBOM describes the application's npm dependency tree but says nothing about:
- Node.js version (engines field says `>=20 <21` — the actual runtime version is not recorded)
- OS / container base image (the app runs in a container; the base image has its own packages with their own CVEs)
- System libraries the Node.js process links against (OpenSSL, libc, etc.)

A full supply chain picture requires an SBOM of the container image layer, not just the application layer.

### 4. The `scope` field is not set on direct dependencies

Query 1 (filtering `c.scope === 'required'`) returned zero results — the generator did not mark direct vs transitive scope on components. This means automated tools that use the SBOM to prioritise direct-dependency findings cannot distinguish between a direct dep you own and a transitive dep buried five levels deep.

### 5. No integrity hashes for vendor packages

npm-resolved packages carry `purl` and optionally content hashes. Vendor packages loaded from `file:` references have no content hash in the SBOM — there is no way to verify that the files on disk match what was audited at SBOM generation time.

### 6. devDependencies are excluded

`supertest` and the `license-checker` tooling are not in the SBOM (correct for a production artifact). However, if dev tooling is ever used in the build pipeline or CI image, its supply chain risk is invisible.

### 7. No VEX (Vulnerability Exploitability eXchange) data

CycloneDX supports attaching VEX statements — machine-readable declarations that a known CVE is or is not exploitable in a specific application. The generated SBOM has no VEX component. The reachability findings from the vulnerability assessment (lodash: exploitable; minimist: not reachable) live only in a prose report and cannot be consumed by automated scanners. Adding VEX would let tools like Dependency-Track suppress the minimist false positive automatically.