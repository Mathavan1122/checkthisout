#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Policy tables 
const ACCEPTED_SPDX = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSD-0-Clause",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "Zlib",
  "BlueOak-1.0.0",
]);


const PROHIBITED_SPDX = new Set([
  "GPL-2.0",
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "LGPL-2.0",
  "LGPL-2.0-only",
  "LGPL-2.0-or-later",
  "LGPL-2.1",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "AGPL-1.0",
  "AGPL-3.0",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "SSPL-1.0",
  "BUSL-1.1",
  "OSL-3.0",
  "EUPL-1.1",
  "EUPL-1.2",
]);

const PROHIBITED_TEXT_PATTERNS = [
  /GNU General Public License/i,
  /GNU Affero General Public License/i,
  /Server Side Public License/i,
  /Business Source License/i,
  /Commons Clause/i,
  /Additional Commercial Terms/i,
  /not.*(?:commercial|production|revenue)/i,
  /Annual Recurring Revenue/i,
  /field of use/i,
];

const REVIEW_TEXT_PATTERNS = [
  /dual.licen[sc]e/i,
  /or.*GPL/i,
  /Creative Commons/i,
  /Elastic License/i,
  /SSPL/i,
  /Polyform/i,
  /Fair Source/i,
];

function readLicenseText(licenseFile) {
  if (!licenseFile || !fs.existsSync(licenseFile)) return "";
  try {
    return fs.readFileSync(licenseFile, "utf8");
  } catch {
    return "";
  }
}

function spdxTokens(spdxExpr) {
  // Extract individual identifiers from expressions like "(MIT OR GPL-3.0-or-later)"
  return (spdxExpr || "")
    .replace(/[()]/g, " ")
    .split(/\s+(?:AND|OR|WITH)\s+|\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function classifyPackage(name, info) {
  const declaredLicense = info.licenses || "UNKNOWN";
  const licenseText = readLicenseText(info.licenseFile);
  const tokens = spdxTokens(declaredLicense);

  // 1. Text-based prohibited scan
  for (const pattern of PROHIBITED_TEXT_PATTERNS) {
    if (pattern.test(licenseText)) {
      return {
        verdict: "PROHIBITED",
        reason: `License text matches prohibited pattern: ${pattern}`,
        declared: declaredLicense,
      };
    }
  }

  // 2. SPDX token prohibited scan
  for (const token of tokens) {
    if (PROHIBITED_SPDX.has(token)) {
      return {
        verdict: "PROHIBITED",
        reason: `Declared SPDX token '${token}' is prohibited (GPL/AGPL/SSPL/BUSL)`,
        declared: declaredLicense,
      };
    }
  }

  // 3. Text-based review scan
  for (const pattern of REVIEW_TEXT_PATTERNS) {
    if (pattern.test(licenseText)) {
      return {
        verdict: "REVIEW",
        reason: `License text matches review pattern: ${pattern}`,
        declared: declaredLicense,
      };
    }
  }

  // 4. "UNLICENSED" or missing → review (no rights granted)
  if (
    declaredLicense === "UNLICENSED" ||
    declaredLicense === "UNKNOWN" ||
    !declaredLicense
  ) {
    return {
      verdict: "REVIEW",
      reason: "No license declared – all rights reserved by default",
      declared: declaredLicense,
    };
  }

  // 5. Dual-license SPDX expressions
  if (/\bOR\b/.test(declaredLicense)) {
    const allClean = tokens.every((t) => ACCEPTED_SPDX.has(t));
    if (!allClean) {
      return {
        verdict: "REVIEW",
        reason: `Dual-license expression '${declaredLicense}' – one arm may not be permissive`,
        declared: declaredLicense,
      };
    }
    // All OR arms are clean
  }

  // 6. All tokens must be in the accepted set
  const unrecognised = tokens.filter((t) => !ACCEPTED_SPDX.has(t));
  if (unrecognised.length) {
    return {
      verdict: "REVIEW",
      reason: `Unrecognised/unrated SPDX token(s): ${unrecognised.join(", ")}`,
      declared: declaredLicense,
    };
  }

  return { verdict: "ACCEPTED", reason: "Permissive license", declared: declaredLicense };
}

// Main entry point
function main() {
  console.log("\n🔍  convo-hub-api – License Gate\n");

  // Run license-checker and parse output
  let raw;
  try {
    raw = execSync(
      "npx --yes license-checker-rseidelsohn --production --json --excludePrivatePackages",
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString();
  } catch (err) {
    console.error("❌  license-checker failed:", err.message);
    process.exit(1);
  }

  const inventory = JSON.parse(raw);

  const prohibited = [];
  const review = [];
  const accepted = [];

  for (const [pkgName, info] of Object.entries(inventory)) {
    const result = classifyPackage(pkgName, info);
    const entry = { package: pkgName, ...result };

    if (result.verdict === "PROHIBITED") prohibited.push(entry);
    else if (result.verdict === "REVIEW") review.push(entry);
    else accepted.push(entry);
  }

  if (accepted.length) {
    console.log(`ACCEPTED (${accepted.length} packages)`);
    accepted.forEach((e) =>
      console.log(`    ${e.package}  [${e.declared}]`)
    );
  }

  if (review.length) {
    console.log(`\nREVIEW NEEDED (${review.length} packages) – non-blocking`);
    review.forEach((e) => {
      console.log(`    ${e.package}  [${e.declared}]`);
      console.log(`      → ${e.reason}`);
    });
  }

  if (prohibited.length) {
    console.log(`\nPROHIBITED (${prohibited.length} packages) – PR BLOCKED`);
    prohibited.forEach((e) => {
      console.log(`    ${e.package}  [${e.declared}]`);
      console.log(`      → ${e.reason}`);
    });
  }

  // ── Write GitHub Actions outputs ─────────────────────────────────────────
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const reviewList = JSON.stringify(review.map((e) => e.package));
    const prohibitedList = JSON.stringify(prohibited.map((e) => e.package));
    fs.appendFileSync(githubOutput, `review_needed=${review.length > 0}\n`);
    fs.appendFileSync(githubOutput, `review_packages=${reviewList}\n`);
    fs.appendFileSync(githubOutput, `prohibited_packages=${prohibitedList}\n`);
  }

  // ── Exit code ────────────────────────────────────────────────────────────
  if (prohibited.length > 0) {
    console.log(
      "\nBuild FAILED – remove or replace prohibited dependencies before merging.\n"
    );
    process.exit(1);
  }

  console.log("\nLicense gate passed.\n");
  process.exit(0);
}

main();