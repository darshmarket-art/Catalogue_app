# Use official Node.js 22 LTS slim image (required for Vite 8)
FROM node:22-slim

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (use legacy-peer-deps to avoid React 19 tree conflicts)
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Build Vite client assets into /app/dist
RUN npm run build

# Cloud Run environment defaults
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run server
CMD ["npm", "start"]
