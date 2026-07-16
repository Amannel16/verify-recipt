# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL required by Prisma Client
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy source code and other files
COPY . .

# Generate Prisma Client and build TypeScript source
RUN npm run db:generate
RUN npm run build

# Stage 2: Runtime stage
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma Client in production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy configuration files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled files and Prisma Client assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma

# Copy local trained data for Tesseract.js
COPY --from=builder /app/eng.traineddata ./eng.traineddata

# Expose the API port
EXPOSE 6000

# Start the application
CMD ["npm", "start"]
