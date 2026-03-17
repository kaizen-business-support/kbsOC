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
# Si .env existe, on réutilise son mot de passe pour éviter tout désalignement.
DB_PASS="${DB_PASSWORD:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-password) DB_PASS="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [[ -z "$DB_PASS" && -f "$BACKEND_ENV" ]]; then
  EXISTING_PASS=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" \
    | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
  [[ -n "$EXISTING_PASS" ]] && DB_PASS="$EXISTING_PASS" \
    && warn "Mot de passe DB récupéré depuis backend/.env existant."
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
apt install -y curl git build-essential openssl ca-certificates gnupg lsb-release python3

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
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl enable --now redis-server
log "Redis $(redis-server --version | awk '{print $3}' | tr -d 'v=')"

# --- 6. nginx ---
log "Installation de nginx..."
apt install -y nginx
systemctl enable nginx

# --- 7. Configuration PostgreSQL — utilisateur et base de données ---
log "Configuration de PostgreSQL (user=${DB_USER}, db=${DB_NAME})..."

# 7a. Forcer le chiffrement scram-sha-256 AVANT de créer/modifier le mot de passe.
#     Sans ça, le mot de passe peut être stocké en md5 (ancien format) alors que
#     pg_hba.conf attend scram-sha-256 → "credentials not valid".
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'scram-sha-256';"
sudo -u postgres psql -c "SELECT pg_reload_conf();"
log "Chiffrement des mots de passe : scram-sha-256"

# 7b. Créer l'utilisateur s'il n'existe pas, puis TOUJOURS synchroniser le mot de passe.
#     Le ALTER USER re-hache le mot de passe avec le format actuel (scram-sha-256),
#     ce qui garantit la cohérence même en cas de réinstallation.
sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
log "Utilisateur PostgreSQL : OK"

# 7c. Créer la base si elle n'existe pas
sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
log "Base de données : OK"

# 7d. Privilèges complets (base + schéma + tables + séquences + futurs objets)
sudo -u postgres psql -c \
  "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};"
log "Privilèges : OK"

# 7e. pg_hba.conf — injecter les règles scram-sha-256 pour notre utilisateur
#     avant les règles génériques existantes (première règle qui correspond gagne).
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
if [[ -z "$PG_HBA" || ! -f "$PG_HBA" ]]; then
  error "pg_hba.conf introuvable. Vérifiez votre installation PostgreSQL."
fi

cp "$PG_HBA" "${PG_HBA}.bak.$(date +%Y%m%d_%H%M%S)"

python3 - <<PYEOF
import re, sys

hba_path = "$PG_HBA"
db_name  = "$DB_NAME"
db_user  = "$DB_USER"

with open(hba_path) as f:
    lines = f.readlines()

# Supprimer les anciennes règles optimuscredit pour éviter les doublons
lines = [l for l in lines if db_name not in l and db_user not in l]

# Nos règles à insérer (IPv4 + IPv6)
our_rules = [
    "# OptimusCredit — application user\n",
    f"host    {db_name}    {db_user}    127.0.0.1/32    scram-sha-256\n",
    f"host    {db_name}    {db_user}    ::1/128         scram-sha-256\n",
]

# Insérer avant la première règle 'host' existante (priorité maximale)
insert_at = next(
    (i for i, l in enumerate(lines) if re.match(r'^host\b', l)),
    len(lines)
)
lines[insert_at:insert_at] = our_rules

with open(hba_path, 'w') as f:
    f.writelines(lines)

print(f"pg_hba.conf mis à jour (insertion à la ligne {insert_at + 1})")
PYEOF

systemctl reload postgresql
log "pg_hba.conf : règles scram-sha-256 injectées et PostgreSQL rechargé"

# 7f. Vérification de la connexion — fail fast avec message explicite
log "Test de connexion à la base de données..."
for i in {1..5}; do
  if PGPASSWORD="$DB_PASS" psql \
      -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT 1" &>/dev/null; then
    log "Connexion base de données : OK"
    break
  fi
  [[ $i -eq 5 ]] && error "Impossible de se connecter à la base de données après 5 tentatives.
  Vérifiez : journalctl -u postgresql -n 50
  pg_hba.conf : $PG_HBA"
  sleep 1
done

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
  # Forcer 127.0.0.1 au lieu de localhost pour garantir connexion TCP (pas socket Unix)
  if grep -qE 'DATABASE_URL=postgresql://.*@localhost' "$BACKEND_ENV"; then
    sed -i 's|@localhost:|@127.0.0.1:|g' "$BACKEND_ENV"
    log "DATABASE_URL : localhost → 127.0.0.1 (connexion TCP explicite)"
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

# Re-accorder les privilèges après db push (Prisma crée de nouvelles tables)
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
log "Schéma Prisma synchronisé"

# --- 13. Seed de la base de données ---
log "Initialisation des données initiales..."
cd "$APP_DIR/backend"
npm run seed && log "Seed effectué." \
  || warn "Seed ignoré (données déjà présentes ou erreur non bloquante)."

# --- 14. Build backend TypeScript ---
log "Compilation du backend (TypeScript → dist/)..."
cd "$APP_DIR/backend"
npm run build

# --- 15. Build frontend React ---
log "Compilation du frontend (React → build/)..."
cd "$APP_DIR"
npm run build

# --- 16. Installation de serve ---
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

chown -R www-data:www-data "$APP_DIR"

# --- 19. Configuration nginx ---
log "Configuration de nginx (proxy inverse)..."
cat > /etc/nginx/sites-available/optimuscredit <<'NGINXCONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

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

    location /socket.io {
        proxy_pass         http://127.0.0.1:5007;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

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

ln -sf /etc/nginx/sites-available/optimuscredit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t || error "Configuration nginx invalide."

# --- 20. Démarrage des services ---
log "Activation et démarrage des services..."
systemctl daemon-reload
systemctl enable --now optimuscredit-backend
systemctl enable --now optimuscredit-frontend
systemctl reload nginx

sleep 3

# --- 21. Vérification santé ---
log "Vérification de l'API backend..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:5007/api/health" || echo "000")
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
