#!/usr/bin/env bash
# =============================================================================
#  OptimusCredit — Installation DEV sur Ubuntu 24.04
#  Usage : sudo bash setup-dev.sh
#  Désinstalle tout et réinstalle en mode développement (hot-reload).
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${CYAN}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo ""; echo -e "${BLUE}${BOLD}━━━ $* ━━━${NC}"; }

[[ $EUID -eq 0 ]] || die "Lancez en root : sudo bash setup-dev.sh"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
APP_USER="${SUDO_USER:-focus}"
DB_NAME="optimuscredit_dev"
DB_USER="optimus_dev"
DB_PASS="devpass_$(openssl rand -hex 8)"
BACKEND_PORT=5007
FRONTEND_PORT=3006
MACHINE_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BLUE}${BOLD}  OptimusCredit — Setup DEV${NC}"
echo ""

# =============================================================================
# 1. NETTOYAGE COMPLET
# =============================================================================
section "1. Nettoyage"

for svc in optimuscredit-backend optimuscredit-frontend; do
  systemctl stop    "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
  rm -f "/etc/systemd/system/${svc}.service"
done
systemctl daemon-reload

tmux kill-session -t optimuscredit 2>/dev/null || true
fuser -k ${BACKEND_PORT}/tcp  2>/dev/null || true
fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null || true

info "Suppression node_modules / build / dist..."
rm -rf "$APP_DIR/node_modules"     "$APP_DIR/build"   "$APP_DIR/.env"
rm -rf "$BACKEND_DIR/node_modules" "$BACKEND_DIR/dist" "$BACKEND_DIR/.env"

info "Suppression des bases de données..."
for db in optimuscredit optimuscredit_dev optimus_credit; do
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${db};" 2>/dev/null || true
done
for usr in optimus optimus_dev optimuscredit; do
  sudo -u postgres psql -c "DROP USER IF EXISTS ${usr};" 2>/dev/null || true
done

log "Nettoyage terminé"

# =============================================================================
# 2. DÉPENDANCES SYSTÈME
# =============================================================================
section "2. Dépendances système"

apt-get update -qq

if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  info "Installation Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
log "Node.js : $(node -v)"

if ! command -v psql &>/dev/null; then
  info "Installation PostgreSQL..."
  apt-get install -y postgresql postgresql-client >/dev/null
fi
systemctl start postgresql && systemctl enable postgresql --quiet
log "PostgreSQL : $(psql --version | head -1)"

if ! command -v redis-cli &>/dev/null; then
  info "Installation Redis..."
  apt-get install -y redis-server >/dev/null
fi
systemctl start redis-server && systemctl enable redis-server --quiet
log "Redis : actif"

if ! command -v tmux &>/dev/null; then
  apt-get install -y tmux >/dev/null
fi
log "tmux : $(tmux -V)"

if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx >/dev/null
fi
log "nginx : installé"

# =============================================================================
# 3. BASE DE DONNÉES DEV
# =============================================================================
section "3. Base de données DEV"

sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"        2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
log "Base '${DB_NAME}' créée (user: ${DB_USER})"

# =============================================================================
# 4. FICHIERS .ENV
# =============================================================================
section "4. Fichiers .env"

JWT_SECRET=$(openssl rand -base64 32)
REFRESH_SECRET=$(openssl rand -base64 32)
mkdir -p "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$BACKEND_DIR/backups"

cat > "$BACKEND_DIR/.env" <<EOF
NODE_ENV=development
PORT=${BACKEND_PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1h
REFRESH_SECRET=${REFRESH_SECRET}
REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT},http://localhost:3000,http://${MACHINE_IP}
FRONTEND_URL=http://${MACHINE_IP}
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EOF

cat > "$APP_DIR/.env" <<EOF
HOST=0.0.0.0
PORT=${FRONTEND_PORT}
BROWSER=none
EOF

chown "${APP_USER}:${APP_USER}" "$BACKEND_DIR/.env" "$APP_DIR/.env"
log ".env créés"

# =============================================================================
# 5. CORRECTION URL API (window.location.origin)
# =============================================================================
section "5. Correction URL API"

node -e "
var fs  = require('fs');
var bt  = String.fromCharCode(96);
var rep = 'const API_BASE = ' + bt + '\${window.location.origin}/api' + bt + ';';
var tgt = [
  '${APP_DIR}/src/pages/LoginPage.tsx',
  '${APP_DIR}/src/pages/BackupPage.tsx',
  '${APP_DIR}/src/pages/CreditApplicationPage.tsx',
  '${APP_DIR}/src/pages/ProfilePage.tsx',
  '${APP_DIR}/src/components/TwoFactorSetup.tsx',
  '${APP_DIR}/src/components/WorkflowDetailsDialog.tsx'
];
tgt.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  var c = fs.readFileSync(f, 'utf8');
  var u = c.replace(/const API_BASE = [^\n;]+;/g, rep);
  if (c !== u) { fs.writeFileSync(f, u); console.log('FIXED : ' + f); }
});

// Fix getApiBaseUrl in api.ts
var apiTs = '${APP_DIR}/src/services/api.ts';
if (fs.existsSync(apiTs)) {
  var c = fs.readFileSync(apiTs, 'utf8');
  var newFn = 'const getApiBaseUrl = (): string => {\n  return ' + bt + '\${window.location.origin}/api' + bt + ';\n};';
  var u = c.replace(/const getApiBaseUrl[\s\S]*?\n\};/, newFn);
  if (c !== u) { fs.writeFileSync(apiTs, u); console.log('FIXED : ' + apiTs); }
}
console.log('URL API : OK');
"

# =============================================================================
# 6. INSTALLATION NPM
# =============================================================================
section "6. npm install"

# Réattribuer la propriété avant npm install
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

cd "$BACKEND_DIR"
sudo -u "$APP_USER" npm install
log "Backend : dépendances installées"

cd "$APP_DIR"
sudo -u "$APP_USER" npm install
log "Frontend : dépendances installées"

# =============================================================================
# 7. PRISMA DB PUSH + SEED
# =============================================================================
section "7. Base de données — schéma + seed"

DB_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
cd "$BACKEND_DIR"
sudo -u "$APP_USER" env DATABASE_URL="$DB_URL" npx prisma db push
log "Schéma Prisma appliqué"
sudo -u "$APP_USER" env DATABASE_URL="$DB_URL" npm run seed
log "Seed exécuté"

# =============================================================================
# 8. NGINX — PROXY DEV
# =============================================================================
section "8. nginx"

cat > /etc/nginx/sites-available/optimuscredit-dev <<NGINXEOF
server {
    listen 80;
    server_name ${MACHINE_IP} _;
    client_max_body_size 50M;

    location /api {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         \$http_upgrade;
        proxy_set_header   Connection      "upgrade";
        proxy_set_header   Host            \$host;
        proxy_set_header   X-Real-IP       \$remote_addr;
        proxy_read_timeout 120s;
    }

    location /socket.io {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         \$http_upgrade;
        proxy_set_header   Connection      "upgrade";
    }

    location / {
        proxy_pass         http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         \$http_upgrade;
        proxy_set_header   Connection      "upgrade";
        proxy_set_header   Host            \$host;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/optimuscredit 2>/dev/null || true
ln -sf /etc/nginx/sites-available/optimuscredit-dev \
        /etc/nginx/sites-enabled/optimuscredit-dev
nginx -t && systemctl reload nginx
log "nginx configuré"

# =============================================================================
# 9. DÉMARRAGE DEV AVEC TMUX
# =============================================================================
section "9. Démarrage DEV (tmux)"

DB_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

tmux new-session -d -s optimuscredit -n backend
tmux send-keys -t optimuscredit:backend \
  "cd ${BACKEND_DIR} && DATABASE_URL='${DB_URL}' npm run dev 2>&1 | tee logs/dev.log" Enter

tmux new-window -t optimuscredit -n frontend
tmux send-keys -t optimuscredit:frontend \
  "cd ${APP_DIR} && npm start 2>&1 | tee /tmp/frontend-dev.log" Enter

log "Serveurs démarrés dans tmux (session : optimuscredit)"
sleep 8

# =============================================================================
# RÉSUMÉ
# =============================================================================
section "Résumé"
echo ""
echo -e "  ${BOLD}Application :${NC}  ${CYAN}http://${MACHINE_IP}${NC}"
echo -e "  ${BOLD}Login :${NC}        admin@bank.sn / demo123"
echo ""
echo -e "  ${BOLD}Base de données :${NC}"
echo "    DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo ""
echo -e "  ${BOLD}Logs en direct :${NC}"
echo "    Backend  : tmux attach -t optimuscredit:backend"
echo "    Frontend : tmux attach -t optimuscredit:frontend"
echo "    Quitter tmux : Ctrl+B puis D"
echo ""
echo -e "  ${BOLD}Arrêt :${NC}"
echo "    tmux kill-session -t optimuscredit"
echo ""
