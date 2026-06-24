FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy server source
COPY server/ ./

# Create a persistent data directory for SQLite and uploads
RUN mkdir -p /data/uploads

# Environment defaults (can be overridden by host)
ENV DB_PATH=/data/todo.db
ENV UPLOADS_PATH=/data/uploads
ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server.js"]
