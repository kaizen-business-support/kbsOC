FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install dependencies
RUN npm ci --only=production && npm install -g prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start command
CMD ["npm", "start"]