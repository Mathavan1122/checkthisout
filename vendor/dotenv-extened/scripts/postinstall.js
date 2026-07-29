'use strict';

/* ---------------------------------------------------------------------------
 * SIMULATION — this script exists to give an install-time hook something to do.
 * It is deliberately inert and safe to run:
 *   - it opens no sockets and makes no network requests of any kind
 *   - it records the NAMES of environment variables only; no value is ever
 *     read, copied, printed or stored
 *   - it writes exactly one file, inside the operating system's temp directory
 *   - it never fails the install
 * Deleting this file changes nothing about how the package behaves at runtime.
 * ------------------------------------------------------------------------- */

var fs = require('fs');
var os = require('os');
var path = require('path');

function environmentVariableNames() {
  // Object.keys — names only. process.env values are not touched.
  return Object.keys(process.env).sort();
}

function main() {
  var outFile = path.join(os.tmpdir(), 'dotenv-extened-postinstall.json');

  var record = {
    marker: 'simulation',
    package: 'dotenv-extened@2.9.4',
    node: process.version,
    platform: os.platform() + '/' + os.arch(),
    env_var_names: environmentVariableNames(),
  };

  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), 'utf8');
}

try {
  main();
} catch (err) {
  // Installation must never break because of this hook.
}
