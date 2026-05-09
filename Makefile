.PHONY: run restart stop down status logs clean-ports nginx-install certbot https

COMPOSE := docker compose
APP_URL ?= http://127.0.0.1:4000
DOMAIN ?=
EMAIL ?=

run: restart

restart: clean-ports
	@test -f .env || (echo "Missing .env in repository root"; exit 1)
	$(COMPOSE) down --remove-orphans
	$(COMPOSE) up -d --build
	@echo "Waiting for application health..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
		if curl -fsS $(APP_URL)/health >/dev/null 2>&1; then \
			echo "Application is up at $(APP_URL)"; \
			$(COMPOSE) ps; \
			exit 0; \
		fi; \
		sleep 2; \
	done; \
	echo "Application did not become healthy in time"; \
	$(COMPOSE) logs --tail=100; \
	exit 1

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down --remove-orphans

status:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=200

nginx-install:
	@test -n "$(DOMAIN)" || (echo "Usage: make nginx-install DOMAIN=lifusa.org"; exit 1)
	@test -f /etc/nginx/nginx.conf || (echo "nginx is not installed"; exit 1)
	./scripts/install-nginx-site.sh $(DOMAIN)

certbot:
	@test -n "$(DOMAIN)" || (echo "Usage: make certbot DOMAIN=lifusa.org EMAIL=you@example.com"; exit 1)
	@test -n "$(EMAIL)" || (echo "Usage: make certbot DOMAIN=lifusa.org EMAIL=you@example.com"; exit 1)
	certbot --nginx --non-interactive --agree-tos -m $(EMAIL) -d $(DOMAIN) --redirect

https: nginx-install certbot
	@echo "HTTPS setup finished for $(DOMAIN)"

clean-ports:
	@for port in 3000 4000; do \
		pids=$$(lsof -ti tcp:$$port || true); \
		if [ -n "$$pids" ]; then \
			echo "Killing stale processes on port $$port: $$pids"; \
			kill $$pids || true; \
		fi; \
	done
