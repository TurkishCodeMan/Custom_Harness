FROM node:20-slim

WORKDIR /app

# Install poppler and python for document parsing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install PyMuPDF and requests
RUN pip3 install --no-cache-dir --break-system-packages pymupdf requests

# Copy standalone package.json and install minimal production dependencies
COPY dist/package.json ./package.json
RUN npm install --omit=dev

# Copy compiled obfuscated server and pre-built frontend
COPY dist/ ./

ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

CMD ["node", "server.mjs"]
