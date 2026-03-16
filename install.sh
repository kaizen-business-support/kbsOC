#!/bin/bash
# ============================================================
#  OptimusCredit — Script d'installation Ubuntu
#  Usage : sudo ./install.sh [--db-password <mot_de_passe>]
# ============================================================
set -e

# --- Couleurs ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

# --- 1. Vérifications préalables ---
[[ -f /etc/os-release ]] && source /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *"ubuntu"* ]]; then
  error "Ce script requiert Ubuntu (22.04 ou plus récent)."
fi
if [[ $EUID -ne 0 ]]; then
  error "Lancez ce script en root : sudo ./install.sh"
fi

# --- Variables ---
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACHINE_IP=$(hostname -I | awk '{print $1}')
DB_NAME="optimuscredit"
DB_USER="optimuscredit"
BACKEND_ENV="$APP_DIR/backend/.env"

# Mot de passe DB : argument CLI > .env existant > auto-généré
# Priorité : si le .env existe déjà, on réutilise son mot de passe pour éviter
# tout désalignement entre le fichier de config et la base de données.
DB_PASS="${DB_PASSWORD:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-password) DB_PASS="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [[ -z "$DB_PASS" && -f "$BACKEND_ENV" ]]; then
  EXISTING_PASS=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
  [[ -n "$EXISTING_PASS" ]] && DB_PASS="$EXISTING_PASS" && warn "Mot de passe DB récupéré depuis backend/.env existant."
fi
[[ -z "$DB_PASS" ]] && DB_PASS=$(openssl rand -hex 16)

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

log "=== Installation OptimusCredit ==="
log "Répertoire : $APP_DIR"
log "IP détectée : $MACHINE_IP"

# --- 2. Dépendances système ---
log "Mise à jour et installation des paquets système..."
apt update -qq
apt install -y curl git build-essential openssl ca-certificates gnupg lsb-release

# --- 3. Node.js 18 ---
log "Installation de Node.js 18..."
NODE_MAJOR=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi
log "Node.js $(node -v) — npm $(npm -v)"

# --- 4. PostgreSQL 15 ---
log "Installation de PostgreSQL 15..."
if ! command -v psql &>/dev/null; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt update -qq
  apt install -y postgresql-15
fi
systemctl enable --now postgresql
log "PostgreSQL $(psql --version | awk '{print $3}')"

# --- 5. Redis 7 ---
log "Installation de Redis 7..."
if ! command -v redis-server &>/dev/null; then
  curl -fsSL https://packages.redis.io/gpg \
    | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
https://packages.redis.io/deb $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/redis.list
  apt update -qq
  apt install -y redis
fi
# Restreindre Redis à localhost
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl enable --now redis-server
log "Redis $(redis-server --version | awk '{print $3}' | tr -d 'v=')"

# --- 6. nginx ---
log "Installation de nginx..."
apt install -y nginx
systemctl enable nginx

# --- 7. Utilisateur et base de données PostgreSQL ---
log "Configuration de PostgreSQL (user=${DB_USER}, db=${DB_NAME})..."

# Créer l'utilisateur s'il n'existe pas, puis TOUJOURS synchroniser son mot de passe.
# Sans ce ALTER USER, une réinstallation génère un nouveau mot de passe en .env
# mais laisse l'ancien en base → erreur "credentials not valid".
sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -c \
  "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# Privilèges base de données
sudo -u postgres psql -c \
  "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# Privilèges schéma et tables (PostgreSQL 15+ : public schema n'est plus ouvert par défaut)
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
# Garantir les privilèges sur les futures tables créées par Prisma
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};"

log "Utilisateur et base de données configurés"

# --- 7b. Configuration pg_hba.conf (authentification par mot de passe) ---
log "Configuration de l'authentification PostgreSQL..."
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
if [[ -n "$PG_HBA" && -f "$PG_HBA" ]]; then
  # Supprimer les anciennes règles spécifiques à optimuscredit pour éviter les doublons
  sed -i "/optimuscredit/d" "$PG_HBA"
  # Injecter les règles scram-sha-256 pour notre utilisateur (IPv4 + IPv6)
  # Insertion après la ligne "# IPv4 local connections:" si elle existe, sinon en fin de fichier
  if grep -q "# IPv4 local connections:" "$PG_HBA"; then
    sed -i "/# IPv4 local connections:/a host    ${DB_NAME}    ${DB_USER}    127.0.0.1\/32    scram-sha-256" "$PG_HBA"
  else
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
  fi
  if grep -q "# IPv6 local connections:" "$PG_HBA"; then
    sed -i "/# IPv6 local connections:/a host    ${DB_NAME}    ${DB_USER}    ::1\/128    scram-sha-256" "$PG_HBA"
  else
    echo "host    ${DB_NAME}    ${DB_USER}    ::1/128    scram-sha-256" >> "$PG_HBA"
  fi
  systemctl reload postgresql
  log "pg_hba.conf mis à jour — authentification scram-sha-256 activée pour ${DB_USER}"
else
  warn "pg_hba.conf introuvable — vérification manuelle recommandée."
fi

# Vérifier la connectivité DB avant de continuer
if ! PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
  error "Impossible de se connecter à la base de données après configuration. Vérifiez pg_hba.conf et les logs : journalctl -u postgresql -n 50"
fi
log "Connexion base de données : OK"

# --- 8. Fichier .env backend ---
if [[ ! -f "$BACKEND_ENV" ]]; then
  log "Génération de backend/.env..."
  cat > "$BACKEND_ENV" <<EOF
NODE_ENV=production
PORT=5007
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRY=1h
REDIS_URL=redis://127.0.0.1:6379
FRONTEND_URL=http://${MACHINE_IP}:3006
FRONTEND_PORT=3006
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
AUDIT_RETENTION_DAYS=60
EOF
else
  warn "backend/.env existe déjà — conservé tel quel."
  # Mettre à jour DATABASE_URL avec l'IP explicite pour éviter les ambiguïtés localhost/socket
  if grep -q 'DATABASE_URL=postgresql://.*@localhost:' "$BACKEND_ENV"; then
    sed -i 's|@localhost:|@127.0.0.1:|' "$BACKEND_ENV"
    log "DATABASE_URL mise à jour : localhost → 127.0.0.1 (connexion TCP explicite)"
  fi
fi

# --- 9. Fichier .env frontend ---
FRONTEND_ENV="$APP_DIR/.env"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  log "Génération de .env (frontend)..."
  cat > "$FRONTEND_ENV" <<EOF
REACT_APP_API_PORT=5007
HOST=0.0.0.0
PORT=3006
EOF
else
  warn ".env (frontend) existe déjà — conservé tel quel."
fi

# --- 10. Dépendances npm backend ---
log "Installation des dépendances backend..."
cd "$APP_DIR/backend"
npm install

# --- 11. Dépendances npm frontend ---
log "Installation des dépendances frontend..."
cd "$APP_DIR"
npm install

# --- 12. Prisma : génération client + migration ---
log "Application du schéma Prisma..."
cd "$APP_DIR/backend"
set -o allexport && source "$BACKEND_ENV" && set +o allexport
npx prisma generate
npx prisma db push --accept-data-loss

# Re-accorder les privilèges après db push (Prisma peut créer de nouvelles tables)
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
log "Schéma Prisma synchronisé"

# --- 13. Seed de la base de données ---
log "Initialisation des données initiales..."
cd "$APP_DIR/backend"
npm run seed && log "Seed effectué." || warn "Seed ignoré (données déjà présentes ou erreur non bloquante)."

# --- 14. Build backend TypeScript ---
log "Compilation du backend (TypeScript → dist/)..."
cd "$APP_DIR/backend"
npm run build

# --- 15. Build frontend React ---
log "Compilation du frontend (React → build/)..."
cd "$APP_DIR"
npm run build

# --- 16. Installation de serve (pour les fichiers statiques React) ---
log "Installation de serve (serveur de fichiers statiques)..."
npm install -g serve
SERVE_BIN="$(npm root -g)/../bin/serve"
[[ ! -x "$SERVE_BIN" ]] && SERVE_BIN="$(which serve)"

# --- 17. Service systemd backend ---
log "Création du service optimuscredit-backend..."
cat > /etc/systemd/system/optimuscredit-backend.service <<EOF
[Unit]
Description=OptimusCredit Backend API
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=/usr/bin/node ${APP_DIR}/backend/dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=optimuscredit-backend

[Install]
WantedBy=multi-user.target
EOF

# --- 18. Service systemd frontend ---
log "Création du service optimuscredit-frontend..."
cat > /etc/systemd/system/optimuscredit-frontend.service <<EOF
[Unit]
Description=OptimusCredit Frontend (React)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}
ExecStart=${SERVE_BIN} -s ${APP_DIR}/build -l 3006
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=optimuscredit-frontend

[Install]
WantedBy=multi-user.target
EOF

# Droits d'accès pour www-data
chown -R www-data:www-data "$APP_DIR"

# --- 19. Configuration nginx ---
log "Configuration de nginx (proxy inverse)..."
cat > /etc/nginx/sites-available/optimuscredit <<'NGINXCONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    # Backend API
    location /api {
        proxy_pass         http://127.0.0.1:5007;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # WebSocket Socket.IO
    location /socket.io {
        proxy_pass         http://127.0.0.1:5007;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend React
    location / {
        proxy_pass         http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXCONF

# --- 20. Activer le site nginx ---
ln -sf /etc/nginx/sites-available/optimuscredit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t || error "Configuration nginx invalide, vérifiez /etc/nginx/sites-available/optimuscredit"

# --- 21. Démarrage et activation au boot ---
log "Activation et démarrage des services..."
systemctl daemon-reload
systemctl enable --now optimuscredit-backend
systemctl enable --now optimuscredit-frontend
systemctl reload nginx

# Attendre que les services soient prêts
sleep 3

# --- 22. Vérification santé ---
log "Vérification de l'API backend..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5007/api/health" || echo "000")
if [[ "$HEALTH_STATUS" == "200" ]]; then
  log "API backend : OK (HTTP 200)"
else
  warn "API backend HTTP ${HEALTH_STATUS} — vérifiez : journalctl -u optimuscredit-backend -n 50"
fi

# --- Résumé final ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   OptimusCredit installé avec succès !   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Application :${NC}  http://${MACHINE_IP}"
echo -e "  ${BLUE}API Backend :${NC}  http://${MACHINE_IP}/api"
echo -e "  ${BLUE}Health      :${NC}  http://${MACHINE_IP}/api/health"
echo ""
echo -e "${YELLOW}  Commandes utiles :${NC}"
echo "    systemctl status optimuscredit-backend"
echo "    systemctl status optimuscredit-frontend"
echo "    journalctl -u optimuscredit-backend  -f"
echo "    journalctl -u optimuscredit-frontend -f"
echo ""
echo -e "${YELLOW}  Redémarrage après reboot :${NC} activé (systemctl enable)"
echo ""
echo -e "${RED}  IMPORTANT — Sauvegardez ces informations :${NC}"
echo "    DB_USER  = ${DB_USER}"
echo "    DB_NAME  = ${DB_NAME}"
echo "    DB_PASS  = ${DB_PASS}"
echo ""
