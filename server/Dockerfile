# Stage 1: Build stage (compile TypeScript to JavaScript)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy server source code
COPY . .

# Compile TypeScript
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency manifests and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled dist from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory, non-root system user & group, and assign ownership of /app
RUN mkdir -p /app/logs && \
    addgroup --system --gid 1001 expressjs && \
    adduser --system --uid 1001 expressjs --ingroup expressjs && \
    chown -R expressjs:expressjs /app

USER expressjs

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
