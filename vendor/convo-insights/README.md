# convo-insights

Funnel, cohort and response-time analytics primitives for conversation data.

```js
const insights = require('convo-insights');

insights.funnel(rows, { stages: ['new', 'assigned', 'resolved'], stageKey: 'status' });
insights.responseTimeHistogram(messages, {
  directionKey: 'direction',
  timestampKey: 'created_at',
  bucketsMinutes: [1, 5, 15, 60],
});
```

## Licensing

convo-insights is published under the GNU Affero General Public License v3.0
(see `LICENSE`). A separate commercial licence is not offered.
