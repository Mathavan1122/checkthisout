'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const mkdirp = require('mkdirp');

const { MEDIA_DIRNAME } = require('../constants');

const router = express.Router();

const MEDIA_ROOT = path.resolve(__dirname, '..', '..', MEDIA_DIRNAME);

// Attachment blobs live on the container's ephemeral disk until the archiver
// job ships them to object storage.
mkdirp.sync(MEDIA_ROOT);

// Blob ids are minted here, never supplied by a caller: 16 lowercase hex chars.
const BLOB_ID = /^[0-9a-f]{16}$/;

router.post('/', express.raw({ type: 'application/octet-stream', limit: '8mb' }), (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'empty_body' });
    }

    const blobId = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(path.join(MEDIA_ROOT, `${blobId}.bin`), req.body);

    return res.status(201).json({ id: blobId, bytes: req.body.length });
  } catch (err) {
    return next(err);
  }
});

// GET /v1/media/:id
// `id` is rejected unless it matches BLOB_ID exactly, so it cannot carry a
// separator, a dot segment, or an absolute prefix. path.basename is applied on
// top of that before the id is joined onto the fixed MEDIA_ROOT.
router.get('/:id', (req, res, next) => {
  try {
    const requested = req.params.id;

    if (!BLOB_ID.test(requested)) {
      return res.status(400).json({ error: 'invalid_blob_id' });
    }

    const filePath = path.join(MEDIA_ROOT, `${path.basename(requested)}.bin`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'blob_not_found' });
    }

    res.type('application/octet-stream');
    return res.send(fs.readFileSync(filePath));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
