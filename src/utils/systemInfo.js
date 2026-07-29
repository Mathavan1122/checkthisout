'use strict';

const { execSync } = require('child_process');

const { RUNTIME_PROBE } = require('../constants');

let cached = null;

// `binary` is a seam for the platform team: during a runtime upgrade rehearsal
// they point the probe at a candidate binary from a scratch script. Inside the
// service there is exactly one call site — runtimeFingerprint() below — and it
// passes nothing, so the value used in production is always RUNTIME_PROBE from
// src/constants.js. No request data reaches this function.
function probeVersion(binary = RUNTIME_PROBE) {
  return execSync(`${binary} --version`, { timeout: 2000 }).toString().trim();
}

// Reports the runtime version that is actually serving traffic so a rolling
// upgrade can be confirmed from /health. Probed once per process.
function runtimeFingerprint() {
  if (cached) return cached;

  try {
    cached = probeVersion();
  } catch (err) {
    cached = 'unknown';
  }

  return cached;
}

module.exports = { runtimeFingerprint };
