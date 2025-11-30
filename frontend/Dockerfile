FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time env
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://gateway:8080

# Build for production
RUN npm run build

# Runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","run","start"]