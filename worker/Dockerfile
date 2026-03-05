FROM node:20-slim

RUN apt-get update && apt-get install -y \
    imagemagick \
    libreoffice \
    ffmpeg \
    zip \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY converters ./converters
RUN npm run build

# tsconfig has no rootDir, so output mirrors source structure
CMD ["node", "dist/src/worker.js"]
