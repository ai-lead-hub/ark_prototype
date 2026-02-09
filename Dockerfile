FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (need all deps for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Copy only what we need
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/package*.json ./

# Install production deps only
RUN npm ci --omit=dev && npm cache clean --force

# Environment defaults
ENV NODE_ENV=production
ENV FILE_API_PORT=8787
ENV FILE_STORAGE_ROOT=/data
ENV FILE_API_REQUIRE_TOKEN=true
ENV FILE_ENABLE_CLIENT_LOG_ENDPOINT=false

# Expose port
EXPOSE 8787

# Create data directory
RUN mkdir -p /data && chown -R node:node /data /app

# Drop privileges
USER node

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8787/ready || exit 1

# Start server
CMD ["npm", "start"]
