'use strict';

// Analytics primitives for conversation datasets. Everything here operates on
// plain arrays of rows so it can sit behind any storage layer.

function funnel(rows, options) {
  var opts = options || {};
  var stages = opts.stages || [];
  var stageKey = opts.stageKey || 'stage';
  var list = Array.isArray(rows) ? rows : [];

  var counts = {};
  stages.forEach(function (stage) {
    counts[stage] = 0;
  });

  var unknown = 0;
  list.forEach(function (row) {
    var stage = row && row[stageKey];
    if (Object.prototype.hasOwnProperty.call(counts, stage)) {
      counts[stage] += 1;
    } else {
      unknown += 1;
    }
  });

  var last = stages.length > 0 ? stages[stages.length - 1] : null;
  var converted = last ? counts[last] : 0;

  return {
    total: list.length,
    stages: counts,
    unknown: unknown,
    conversion_rate: list.length === 0 ? 0 : Number((converted / list.length).toFixed(4)),
  };
}

function responseTimeHistogram(rows, options) {
  var opts = options || {};
  var directionKey = opts.directionKey || 'direction';
  var timestampKey = opts.timestampKey || 'created_at';
  var buckets = (opts.bucketsMinutes || [1, 5, 15, 60]).slice().sort(function (a, b) {
    return a - b;
  });

  var list = Array.isArray(rows) ? rows : [];

  var histogram = {};
  buckets.forEach(function (minutes) {
    histogram['<=' + minutes + 'm'] = 0;
  });
  histogram['>' + buckets[buckets.length - 1] + 'm'] = 0;

  var pendingInbound = null;
  var samples = [];

  list.forEach(function (row) {
    if (!row) return;
    var at = new Date(row[timestampKey]).getTime();
    if (isNaN(at)) return;

    if (row[directionKey] === 'inbound') {
      if (pendingInbound === null) pendingInbound = at;
      return;
    }

    if (pendingInbound !== null) {
      samples.push((at - pendingInbound) / 60000);
      pendingInbound = null;
    }
  });

  samples.forEach(function (minutes) {
    for (var i = 0; i < buckets.length; i += 1) {
      if (minutes <= buckets[i]) {
        histogram['<=' + buckets[i] + 'm'] += 1;
        return;
      }
    }
    histogram['>' + buckets[buckets.length - 1] + 'm'] += 1;
  });

  samples.sort(function (a, b) {
    return a - b;
  });

  return {
    samples: samples.length,
    buckets: histogram,
    median_minutes: samples.length === 0 ? null : Number(samples[Math.floor(samples.length / 2)].toFixed(2)),
  };
}

module.exports = {
  funnel: funnel,
  responseTimeHistogram: responseTimeHistogram,
};
