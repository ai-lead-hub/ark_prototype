FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (need all deps for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy only what we need
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Install production deps only
RUN npm ci --only=production

# Environment defaults
ENV NODE_ENV=production
ENV FILE_API_PORT=8787
ENV FILE_STORAGE_ROOT=/data

# Expose port
EXPOSE 8787

# Create data directory
RUN mkdir -p /data

# Start server
CMD ["npm", "start"]
