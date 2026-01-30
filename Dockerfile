# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev for prisma generate)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy source code
COPY src ./src/

# GCP Cloud Run sets PORT env variable automatically
ENV PORT=8080
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Run the app
CMD ["node", "src/index.js"]
