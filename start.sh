#!/bin/sh
set -e
php-fpm -D
echo "PHP-FPM started"
nginx -g "daemon off;"
