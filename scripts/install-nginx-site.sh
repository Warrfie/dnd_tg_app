#!/usr/bin/env sh
set -eu

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

TEMPLATE_PATH="/root/dnd_tg_app/infra/nginx/lifusa.org.conf.template"
TARGET_PATH="/etc/nginx/sites-available/$DOMAIN"
LINK_PATH="/etc/nginx/sites-enabled/$DOMAIN"

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "Template not found: $TEMPLATE_PATH"
  exit 1
fi

sed "s/__DOMAIN__/$DOMAIN/g" "$TEMPLATE_PATH" > "$TARGET_PATH"
ln -sf "$TARGET_PATH" "$LINK_PATH"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Installed nginx site for $DOMAIN"

