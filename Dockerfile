FROM node:20-alpine AS builder

WORKDIR /app

COPY client/ ./client/
COPY server/ ./server/

RUN cd client && npm install && npm run build
RUN cd server && npm install

FROM node:20-alpine

RUN apk add --no-cache tini nginx

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY --from=builder /app/server /app/server
COPY nginx.conf /etc/nginx/http.d/default.conf

WORKDIR /app/server

ENV NODE_ENV=production SERVER_PORT=5000

EXPOSE 80

ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "node server.js & nginx -g 'daemon off;'"]