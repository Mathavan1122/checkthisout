'use strict';

const insights = require('convo-insights');

// Turns raw conversation rows into the funnel + response-time numbers the
// workspace dashboard renders.
function funnel(conversationRows) {
  return insights.funnel(conversationRows, {
    stages: ['new', 'assigned', 'engaged', 'resolved'],
    stageKey: 'status',
  });
}

function responseTimes(messageRows) {
  return insights.responseTimeHistogram(messageRows, {
    directionKey: 'direction',
    timestampKey: 'created_at',
    bucketsMinutes: [1, 5, 15, 60, 240],
  });
}

module.exports = { funnel, responseTimes };
