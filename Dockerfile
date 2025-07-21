# Use official Node.js runtime as parent image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Create uploads directory for temporary files
RUN mkdir -p public/uploads/components

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]