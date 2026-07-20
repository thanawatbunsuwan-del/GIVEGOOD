FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Expose HTTP port
EXPOSE 5000

# Command to run on server
CMD ["node", "server.js"]
