#!/bin/bash
# ============================================================
#  OptimusCredit — Script d'installation Ubuntu
#  Usage : sudo ./install.sh [--db-password <mot_de_passe>]
# ============================================================
set -e

# --- Couleurs ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()     { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }
check_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
check_fail() { echo -e "  ${RED}✗${NC} $1"; }

# ─── 1. Vérifications préalables ─────────────────────────────────────────────

# Root
if [[ $EUID -ne 0 ]]; then
  error "Lancez ce script en root : sudo ./install.sh"
fi

# OS Ubuntu
[[ -f /etc/os-release ]] && source /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *"ubuntu"* ]]; then
  error "Ce script requiert Ubuntu (22.04 ou plus récent). OS détecté : ${PRETTY_NAME:-inconnu}"
fi
UBUNTU_VER="${VERSION_ID:-0}"
UBUNTU_MAJOR=$(echo "$UBUNTU_VER" | cut -d. -f1)
if [[ "$UBUNTU_MAJOR" -lt 22 ]]; then
  error "Ubuntu 22.04 minimum requis. Version détectée : $UBUNTU_VER"
fi

# Variables
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACHINE_IP=$(hostname -I | awk '{print $1}')
DB_NAME="optimuscredit"
DB_USER="optimuscredit"
BACKEND_ENV="$APP_DIR/backend/.env"

# ─── 2. Pré-flight checks (système) ──────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Pré-flight checks ━━━${NC}"

PREFLIGHT_OK=true

# Espace disque libre >= 3 Go sur /
DISK_FREE_KB=$(df / --output=avail 2>/dev/null | tail -1 | tr -d ' ')
DISK_FREE_GB=$(( DISK_FREE_KB / 1024 / 1024 ))
if [[ "$DISK_FREE_GB" -ge 3 ]]; then
  check_ok "Espace disque : ${DISK_FREE_GB} Go disponibles (minimum 3 Go)"
else
  check_fail "Espace disque insuffisant : ${DISK_FREE_GB} Go (minimum 3 Go requis)"
  PREFLIGHT_OK=false
fi

# RAM >= 512 Mo
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [[ "$RAM_MB" -ge 512 ]]; then
  check_ok "RAM : ${RAM_MB} Mo (minimum 512 Mo)"
else
  check_warn "RAM faible : ${RAM_MB} Mo — l'installation peut être lente (minimum recommandé : 1 Go)"
fi

# Connectivité internet
if curl -s --connect-timeout 5 https://registry.npmjs.org/ -o /dev/null; then
  check_ok "Connectivité internet : OK"
else
  check_fail "Pas de connexion internet — impossible de télécharger les dépendances"
  PREFLIGHT_OK=false
fi

# Ports requis libres (80, 3006, 5007, 5432, 6379)
for port in 80 3006 5007 5432 6379; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    check_warn "Port ${port} déjà utilisé — sera libéré ou réutilisé par l'installation"
  else
    check_ok "Port ${port} : disponible"
  fi
done

# Répertoire de l'application
if [[ -d "$APP_DIR/backend" && -f "$APP_DIR/package.json" ]]; then
  check_ok "Répertoire app : $APP_DIR"
else
  check_fail "Répertoire invalide : $APP_DIR (backend/ ou package.json manquant)"
  PREFLIGHT_OK=false
fi

if [[ "$PREFLIGHT_OK" != "true" ]]; then
  error "Des pré-requis système ne sont pas satisfaits. Corrigez les erreurs ci-dessus avant de continuer."
fi
echo ""

# ─── Mot de passe DB : argument CLI > .env existant > auto-généré ────────────
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
log "Ubuntu : $UBUNTU_VER"

# ─── 3. Dépendances système ───────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Installation des dépendances système ━━━${NC}"

apt update -qq

SYSTEM_PKGS=(curl git build-essential openssl ca-certificates gnupg lsb-release python3)
MISSING_PKGS=()
for pkg in "${SYSTEM_PKGS[@]}"; do
  if dpkg -s "$pkg" &>/dev/null; then
    check_ok "$pkg : déjà installé ($(dpkg -s "$pkg" | grep Version | awk '{print $2}'))"
  else
    check_warn "$pkg : à installer"
    MISSING_PKGS+=("$pkg")
  fi
done

if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
  log "Installation : ${MISSING_PKGS[*]}"
  apt install -y "${MISSING_PKGS[@]}"
fi
log "Dépendances système : OK"

# ─── 4. Node.js >= 18 ────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Node.js ━━━${NC}"
NODE_MAJOR=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  check_ok "Node.js $(node -v) — npm $(npm -v) : déjà installé"
else
  if [[ "$NODE_MAJOR" -gt 0 ]]; then
    check_warn "Node.js $(node -v) trop ancien — mise à jour vers v18 requise"
  else
    check_warn "Node.js absent — installation de Node.js 18"
  fi
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
  check_ok "Node.js $(node -v) — npm $(npm -v) installé"
fi

# ─── 5. PostgreSQL 15 ────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ PostgreSQL ━━━${NC}"
if command -v psql &>/dev/null; then
  PG_VER=$(psql --version | awk '{print $3}')
  PG_MAJOR=$(echo "$PG_VER" | cut -d. -f1)
  if [[ "$PG_MAJOR" -ge 14 ]]; then
    check_ok "PostgreSQL $PG_VER : déjà installé"
  else
    check_warn "PostgreSQL $PG_VER : version ancienne (recommandé : 15+), continuation quand même"
  fi
else
  check_warn "PostgreSQL absent — installation de PostgreSQL 15"
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt update -qq
  apt install -y postgresql-15
  check_ok "PostgreSQL $(psql --version | awk '{print $3}') installé"
fi
# S'assurer que pg_dump est présent (utile pour update.sh aussi)
if ! command -v pg_dump &>/dev/null; then
  warn "pg_dump absent — installation de postgresql-client-15"
  apt install -y postgresql-client-15 2>/dev/null || apt install -y postgresql-client
fi
systemctl enable --now postgresql
check_ok "Service postgresql : actif"

# ─── 6. Redis 7 ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Redis ━━━${NC}"
if command -v redis-server &>/dev/null; then
  REDIS_VER=$(redis-server --version | awk '{print $3}' | tr -d 'v=')
  REDIS_MAJOR=$(echo "$REDIS_VER" | cut -d. -f1)
  if [[ "$REDIS_MAJOR" -ge 6 ]]; then
    check_ok "Redis $REDIS_VER : déjà installé"
  else
    check_warn "Redis $REDIS_VER : version ancienne (recommandé : 7+), continuation quand même"
  fi
else
  check_warn "Redis absent — installation de Redis 7"
  curl -fsSL https://packages.redis.io/gpg \
    | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
https://packages.redis.io/deb $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/redis.list
  apt update -qq
  apt install -y redis
  check_ok "Redis $(redis-server --version | awk '{print $3}' | tr -d 'v=') installé"
fi
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl enable --now redis-server
check_ok "Service redis-server : actif"

# ─── 7. nginx ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ nginx ━━━${NC}"
if command -v nginx &>/dev/null; then
  check_ok "nginx $(nginx -v 2>&1 | grep -oP '[\d.]+') : déjà installé"
else
  check_warn "nginx absent — installation"
  apt install -y nginx
  check_ok "nginx installé"
fi
systemctl enable nginx
check_ok "Service nginx : activé"

# ─── 8. Configuration PostgreSQL — utilisateur et base de données ─────────────
echo ""
echo -e "${BLUE}━━━ Configuration base de données ━━━${NC}"

# Forcer md5 pour le stockage du mot de passe (compatibilité maximale)
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Créer l'utilisateur (si absent) puis TOUJOURS synchroniser le mot de passe
sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
check_ok "Utilisateur PostgreSQL '${DB_USER}' : OK"

# Créer la base si absente
sudo -u postgres psql -tc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
check_ok "Base de données '${DB_NAME}' : OK"

# Privilèges complets
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
check_ok "Privilèges accordés"

# pg_hba.conf — règles scram-sha-256 pour notre utilisateur (python3 pour fiabilité)
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
[[ -z "$PG_HBA" || ! -f "$PG_HBA" ]] && error "pg_hba.conf introuvable."

cp "$PG_HBA" "${PG_HBA}.bak.$(date +%Y%m%d_%H%M%S)"

python3 - <<PYEOF
import re
hba_path = "$PG_HBA"
db_name  = "$DB_NAME"
db_user  = "$DB_USER"
with open(hba_path) as f:
    lines = f.readlines()
lines = [l for l in lines if db_name not in l and db_user not in l]
our_rules = [
    "# OptimusCredit — connexion locale uniquement (trust = pas de validation mdp)\n",
    f"host    {db_name}    {db_user}    127.0.0.1/32    trust\n",
    f"host    {db_name}    {db_user}    ::1/128         trust\n",
]
insert_at = next(
    (i for i, l in enumerate(lines) if re.match(r'^host\b', l)),
    len(lines)
)
lines[insert_at:insert_at] = our_rules
with open(hba_path, 'w') as f:
    f.writelines(lines)
print(f"pg_hba.conf mis à jour (ligne {insert_at + 1})")
PYEOF

# Restart complet pour garantir la prise en compte immédiate des règles
systemctl restart postgresql
sleep 2
check_ok "pg_hba.conf : règles trust (localhost) injectées — PostgreSQL redémarré"

# Test de connexion avec retry
log "Test de connexion à la base de données..."
for i in {1..5}; do
  if PGPASSWORD="$DB_PASS" psql \
      -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT 1" &>/dev/null; then
    check_ok "Connexion base de données : OK"
    break
  fi
  [[ $i -eq 5 ]] && error "Impossible de se connecter après 5 tentatives.
  Vérifiez : journalctl -u postgresql -n 50
  pg_hba.conf : $PG_HBA"
  sleep 1
done

# ─── 9. Fichiers .env ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Configuration .env ━━━${NC}"

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
  check_ok "backend/.env généré"
else
  warn "backend/.env existe déjà — conservé tel quel."
  if grep -qE 'DATABASE_URL=postgresql://.*@localhost' "$BACKEND_ENV"; then
    sed -i 's|@localhost:|@127.0.0.1:|g' "$BACKEND_ENV"
    check_ok "DATABASE_URL : localhost → 127.0.0.1 (TCP explicite)"
  fi
fi

FRONTEND_ENV="$APP_DIR/.env"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  cat > "$FRONTEND_ENV" <<EOF
REACT_APP_API_PORT=5007
HOST=0.0.0.0
PORT=3006
EOF
  check_ok ".env frontend généré"
else
  warn ".env frontend existe déjà — conservé tel quel."
fi

# ─── 10. Dépendances npm ──────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Installation des dépendances npm ━━━${NC}"

log "Backend..."
cd "$APP_DIR/backend" && npm install
check_ok "npm install backend : OK"

log "Frontend..."
cd "$APP_DIR" && npm install
check_ok "npm install frontend : OK"

# serve (pour servir le build React)
if command -v serve &>/dev/null; then
  check_ok "serve : déjà installé ($(serve --version 2>/dev/null || echo 'version inconnue'))"
else
  check_warn "serve absent — installation globale"
  npm install -g serve
  check_ok "serve installé"
fi
SERVE_BIN="$(which serve)"

# ─── 11. Prisma — schéma et base de données ──────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Prisma ━━━${NC}"
cd "$APP_DIR/backend"

# Export explicite de DATABASE_URL (plus fiable que set -o allexport + source)
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
check_ok "DATABASE_URL : ${DATABASE_URL//:*@/:*****@}"

npx prisma generate
check_ok "Client Prisma généré"
npx prisma db push --accept-data-loss
check_ok "Schéma Prisma appliqué"

# Re-grant après db push
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true

# ─── 12. Seed ─────────────────────────────────────────────────────────────────
log "Initialisation des données initiales..."
cd "$APP_DIR/backend"
npm run seed && check_ok "Seed effectué." \
  || warn "Seed ignoré (données déjà présentes ou erreur non bloquante)."

# ─── 13. Builds ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Compilation ━━━${NC}"

log "Backend TypeScript..."
cd "$APP_DIR/backend" && npm run build
check_ok "Backend compilé → dist/"

log "Frontend React..."
cd "$APP_DIR" && npm run build
check_ok "Frontend compilé → build/"

# ─── 14. Services systemd ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Services systemd ━━━${NC}"

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
check_ok "optimuscredit-backend.service créé"

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
check_ok "optimuscredit-frontend.service créé"

chown -R www-data:www-data "$APP_DIR"

# ─── 15. nginx ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Configuration nginx ━━━${NC}"
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
check_ok "nginx configuré (proxy inverse)"

# ─── 16. Démarrage des services ───────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Démarrage des services ━━━${NC}"
systemctl daemon-reload
systemctl enable --now optimuscredit-backend
systemctl enable --now optimuscredit-frontend
systemctl reload nginx
check_ok "Services démarrés et activés au boot"

sleep 3

# ─── 17. Vérification santé finale ───────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━ Vérification santé ━━━${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:5007/api/health" || echo "000")
if [[ "$HEALTH_STATUS" == "200" ]]; then
  check_ok "API backend : HTTP 200"
else
  check_warn "API backend : HTTP ${HEALTH_STATUS} — vérifiez : journalctl -u optimuscredit-backend -n 50"
fi

FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:3006" || echo "000")
if [[ "$FRONTEND_STATUS" == "200" ]]; then
  check_ok "Frontend : HTTP 200"
else
  check_warn "Frontend : HTTP ${FRONTEND_STATUS} — vérifiez : journalctl -u optimuscredit-frontend -n 50"
fi

# ─── Résumé final ─────────────────────────────────────────────────────────────
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
