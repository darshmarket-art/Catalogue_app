# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

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
