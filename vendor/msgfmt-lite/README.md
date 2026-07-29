# msgfmt-lite

Tiny `{placeholder}` message formatter. No runtime dependencies, no compilation
step, no expression evaluation.

```js
const msgfmt = require('msgfmt-lite');

msgfmt.format('Hi {name}, order {order_id} shipped.', { name: 'Chen', order_id: 'A-91' });
// => 'Hi Chen, order A-91 shipped.'

msgfmt.placeholders('Hi {name}, order {order_id}');
// => ['name', 'order_id']
```

Placeholders with no matching variable are left in place, so a missing value
shows up in review instead of rendering as an empty string.

## Licence

MIT. See `LICENSE`.
