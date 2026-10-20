FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/survey.sqlite
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --chown=node:node server.mjs database.mjs export.mjs csv.mjs admin-actions.mjs roster.mjs options.json booking.sql ./
COPY --chown=node:node public ./public
COPY --chown=node:node admin ./admin
USER node
EXPOSE 3000 3001
CMD ["node", "server.mjs"]
