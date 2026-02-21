FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM php:8.2-fpm-alpine

# Install pdo_pgsql extension
RUN apk add --no-cache postgresql-dev nginx \
    && docker-php-ext-install pdo_pgsql

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy PHP API
COPY api/ /usr/share/nginx/html/api/

# Copy login PHP files (used by auth API for AD integration)
COPY login/ /usr/share/nginx/html/login/

# Copy .env for DB credentials (if present)
COPY .env /usr/share/nginx/html/.env

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config if it exists
RUN rm -f /etc/nginx/http.d/default.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]
