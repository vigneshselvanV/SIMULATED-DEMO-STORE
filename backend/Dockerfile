# ==========================================
# ShopSphere Backend Dockerfile
# Production-ready Node.js container
# ==========================================
FROM node:20-slim AS runner

# Install dumb-init for proper signal handling in Node containers
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code and migrations
COPY src ./src
COPY .nvmrc ./

# Create data directory for persistent SQLite database with correct permissions
RUN mkdir -p /app/src/db && chown -R node:node /app

# Run as non-root user for container security
USER node

EXPOSE 5000

# Healthcheck endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]

# Run migrations and start production server
CMD ["sh", "-c", "node src/db/migrationRunner.js && node src/server.js"]
