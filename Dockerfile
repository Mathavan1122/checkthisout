FROM node:20.14-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor

RUN npm ci --omit=dev

FROM node:20.14-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN addgroup -g 10001 -S app && adduser -u 10001 -S -G app app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY vendor ./vendor
COPY src ./src

RUN mkdir -p /app/var/media && chown -R app:app /app/var

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
