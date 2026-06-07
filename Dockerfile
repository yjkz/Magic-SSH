FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY ./ ./

RUN npm run build



FROM node:20-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

ENV LISTEN_HOST=0.0.0.0
ENV PORT=8766
ENV DISABLE_OPEN_BROWSER=1

EXPOSE 8766

CMD ["node", "server/index.js"]



