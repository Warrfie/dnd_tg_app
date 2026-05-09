#!/bin/sh
set -eu

echo "Waiting for PostgreSQL..."
until node -e "const url = new URL(process.env.DATABASE_URL); const net = require('node:net'); const socket = net.connect({ host: url.hostname, port: Number(url.port || 5432) }, () => { socket.end(); process.exit(0); }); socket.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 2000);"; do
  sleep 2
done

echo "Applying database schema..."
npm run db:push

echo "Seeding default data..."
npm run db:seed

echo "Starting application..."
node /app/apps/api/dist/index.js

