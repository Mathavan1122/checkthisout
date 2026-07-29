'use strict';

const { exec } = require('child_process');

// Left over from the v0 self-hosted distribution, when operators drove backups
// and log rotation through an admin console that shipped with the service. The
// console was removed in 1.0 and the HTTP surface that reached these helpers
// went with it.

function runBackup(targetPath, callback) {
  exec(`pg_dump --no-owner --format=custom --file=${targetPath} convo_hub`, (err, stdout, stderr) => {
    callback(err, { stdout, stderr });
  });
}

function rotateLogs(logDir, keepDays, callback) {
  exec(`find ${logDir} -name '*.log' -mtime +${keepDays} -delete`, (err) => callback(err));
}

function tailServiceLog(logName, lines, callback) {
  exec(`tail -n ${lines} /var/log/convo-hub/${logName}`, (err, stdout) => callback(err, stdout));
}

module.exports = { runBackup, rotateLogs, tailServiceLog };
