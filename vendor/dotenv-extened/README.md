# dotenv-extened

Layered defaults and required-key checks on top of `dotenv`.

```js
const extened = require('dotenv-extened');

const env = extened.load({
  defaults: { PORT: '3000', LOG_LEVEL: 'info' },
  required: ['DATABASE_URL'],
});
```

Values already present in `process.env` always win over `defaults`. `load()`
throws if any key listed in `required` is missing or empty.

`bool(value, fallback)` coerces `1/true/yes/on` to `true`.
