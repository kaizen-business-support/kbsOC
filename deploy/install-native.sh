#!/bin/bash
# =============================================================================
#  OptimusCredit — Installation / Mise à jour native Ubuntu (sans Docker)
#  Usage :
#    Première installation : sudo bash install-native.sh
#    Mise à jour           : sudo bash install-native.sh --update
# =============================================================================
set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${BLUE}[i]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✘]${NC} $*" >&2; }
section() { echo -e "\n${BOLD}${CYAN}━━━  $*  ━━━${NC}"; }

# ── Détection mode (install vs update) ───────────────────────────────────────
MODE="install"
[[ "${1:-}" == "--update" ]] && MODE="update"

# ── Chemins ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/optimuscredit"
CONFIG_FILE="$SCRIPT_DIR/.deploy-config"
BACKUP_DIR="/var/backups/optimuscredit"
LOG_DIR="/var/log/optimuscredit"
UPLOADS_DIR="$INSTALL_DIR/uploads"
APP_USER="optimuscredit"

# ── Vérification droits root ──────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Ce script doit être exécuté avec sudo : sudo bash $0 ${1:-}"
  exit 1
fi

# =============================================================================
#  FONCTIONS UTILITAIRES
# =============================================================================

backup_database() {
  section "Sauvegarde de la base de données"
  local backup_file="$BACKUP_DIR/pre-update_$(date +%Y%m%d_%H%M%S).sql.gz"
  mkdir -p "$BACKUP_DIR"

  if systemctl is-active --quiet postgresql; then
    sudo -u postgres pg_dump "$DB_NAME" | gzip > "$backup_file"
    log "Backup créé : $backup_file"
  else
    warn "PostgreSQL inactif — backup ignoré"
  fi
}

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$CONFIG_FILE"
    log "Configuration chargée depuis $CONFIG_FILE"
  else
    error "Fichier de config introuvable : $CONFIG_FILE"
    error "Lancez d'abord l'installation : sudo bash install-native.sh"
    exit 1
  fi
}

save_config() {
  cat > "$CONFIG_FILE" <<EOF
# OptimusCredit — Config déploiement natif (généré le $(date))
SERVER_IP="$SERVER_IP"
DB_USER="$DB_USER"
DB_NAME="$DB_NAME"
DB_PASSWORD="$DB_PASSWORD"
REDIS_PASSWORD="$REDIS_PASSWORD"
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
INSTALL_DIR="$INSTALL_DIR"
APP_USER="$APP_USER"
EOF
  chmod 600 "$CONFIG_FILE"
  log "Configuration sauvegardée dans $CONFIG_FILE"
}

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null \
    || openssl rand -hex 64
}

wait_for_postgres() {
  info "Attente de PostgreSQL..."
  local retries=30
  until sudo -u postgres pg_isready -q 2>/dev/null || [[ $retries -eq 0 ]]; do
    sleep 2; retries=$((retries - 1))
  done
  [[ $retries -gt 0 ]] || { error "PostgreSQL ne répond pas"; exit 1; }
  log "PostgreSQL prêt"
}

# =============================================================================
#  MODE INSTALLATION
# =============================================================================
install_mode() {
  echo -e "${BOLD}${CYAN}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║      OptimusCredit — Installation Native Ubuntu          ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # ── Collecte de la configuration ────────────────────────────────────────────
  section "Configuration"

  read -rp "$(echo -e "${BOLD}IP fixe du serveur Ubuntu sur le réseau local :${NC} ")" SERVER_IP
  [[ -z "$SERVER_IP" ]] && { error "IP requise"; exit 1; }

  DB_USER="optimus"
  DB_NAME="optimus_credit"

  read -rsp "$(echo -e "${BOLD}Mot de passe PostgreSQL (laisser vide = auto-généré) :${NC} ")" DB_PASSWORD
  echo
  [[ -z "$DB_PASSWORD" ]] && DB_PASSWORD="OptimuspgPwd_$(openssl rand -hex 8)"
  info "DB_PASSWORD défini"

  read -rsp "$(echo -e "${BOLD}Mot de passe Redis (laisser vide = auto-généré) :${NC} ")" REDIS_PASSWORD
  echo
  [[ -z "$REDIS_PASSWORD" ]] && REDIS_PASSWORD="OptimisRedis_$(openssl rand -hex 8)"
  info "REDIS_PASSWORD défini"

  JWT_SECRET=$(generate_secret)
  JWT_REFRESH_SECRET=$(generate_secret)
  log "Secrets JWT générés"

  save_config

  # ── Dépendances système ──────────────────────────────────────────────────────
  section "Dépendances système"
  apt update -qq && apt upgrade -y -qq
  apt install -y -qq curl wget git build-essential unzip nginx ufw
  log "Paquets système installés"

  # ── Node.js 20 ───────────────────────────────────────────────────────────────
  section "Node.js 20"
  if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
    apt install -y -qq nodejs
    log "Node.js $(node -v) installé"
  else
    log "Node.js $(node -v) déjà présent"
  fi
  npm install -g pm2 --quiet
  log "PM2 $(pm2 -v) installé"

  # ── PostgreSQL 15 ────────────────────────────────────────────────────────────
  section "PostgreSQL 15"
  if ! command -v psql &>/dev/null; then
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
           > /etc/apt/sources.list.d/pgdg.list'
    wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - > /dev/null
    apt update -qq
    apt install -y -qq postgresql-15 postgresql-client-15
    log "PostgreSQL 15 installé"
  else
    log "PostgreSQL déjà présent : $(psql --version)"
  fi

  systemctl enable postgresql && systemctl start postgresql
  wait_for_postgres

  # Créer user et base si inexistants
  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    log "Utilisateur PostgreSQL '$DB_USER' créé"
  else
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    log "Mot de passe PostgreSQL mis à jour"
  fi

  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    log "Base de données '$DB_NAME' créée"
  else
    log "Base de données '$DB_NAME' déjà existante"
  fi

  # ── Redis ────────────────────────────────────────────────────────────────────
  section "Redis"
  apt install -y -qq redis-server
  sed -i "s/^bind .*/bind 127.0.0.1/" /etc/redis/redis.conf
  if grep -q "^requirepass" /etc/redis/redis.conf; then
    sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
  else
    echo "requirepass $REDIS_PASSWORD" >> /etc/redis/redis.conf
  fi
  sed -i "s/^# maxmemory .*/maxmemory 256mb/" /etc/redis/redis.conf 2>/dev/null || true
  systemctl enable redis-server && systemctl restart redis-server
  log "Redis configuré et démarré"

  # ── Utilisateur système et répertoires ───────────────────────────────────────
  section "Répertoires et permissions"
  id "$APP_USER" &>/dev/null || useradd -r -s /bin/false "$APP_USER"

  mkdir -p "$INSTALL_DIR/backend" "$UPLOADS_DIR" "$BACKUP_DIR" "$LOG_DIR"
  apt install -y -qq postgresql-client-15 acl
  setfacl -m "u:$APP_USER:rx" /usr/bin/pg_dump /usr/bin/psql 2>/dev/null || true
  log "Répertoires créés"

  deploy_application

  seed_database

  configure_nginx

  configure_ufw

  start_pm2

  final_report
}

# =============================================================================
#  DÉPLOIEMENT DE L'APPLICATION (commun install + update)
# =============================================================================
deploy_application() {
  section "Déploiement des fichiers"

  # Backend
  rsync -a --delete \
    --exclude=node_modules --exclude=dist --exclude=.env \
    --exclude=uploads --exclude=logs --exclude=backups \
    "$PROJECT_ROOT/backend/" "$INSTALL_DIR/backend/"
  log "Fichiers backend copiés"

  # Frontend source
  rsync -a --delete \
    --exclude=node_modules --exclude=build --exclude=.env \
    "$PROJECT_ROOT/src/"    "$INSTALL_DIR/frontend-src/src/"
  rsync -a \
    "$PROJECT_ROOT/public/" "$INSTALL_DIR/frontend-src/public/"
  cp "$PROJECT_ROOT/package.json"      "$INSTALL_DIR/frontend-src/"
  cp "$PROJECT_ROOT/package-lock.json" "$INSTALL_DIR/frontend-src/" 2>/dev/null || true
  cp "$PROJECT_ROOT/tsconfig.json"     "$INSTALL_DIR/frontend-src/" 2>/dev/null || true
  log "Sources frontend copiées"

  # Fichier .env backend
  cat > "$INSTALL_DIR/backend/.env" <<EOF
NODE_ENV=production
PORT=5007
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379
ALLOWED_ORIGINS=http://${SERVER_IP}
FRONTEND_URL=http://${SERVER_IP}
UPLOAD_PATH=${UPLOADS_DIR}
BACKUP_DIR=${BACKUP_DIR}
BACKUP_RETENTION_DAYS=30
LOG_LEVEL=warn
EOF
  chmod 600 "$INSTALL_DIR/backend/.env"
  log ".env backend configuré"

  # Dépendances et build backend
  section "Build backend"
  cd "$INSTALL_DIR/backend"
  sudo -u "$APP_USER" npm ci --omit=dev --quiet 2>&1 | tail -3
  sudo -u "$APP_USER" npx prisma generate
  sudo -u "$APP_USER" npx prisma migrate deploy
  sudo -u "$APP_USER" npm run build
  log "Backend compilé et migrations appliquées"

  # Build frontend
  section "Build frontend"
  cd "$INSTALL_DIR/frontend-src"
  npm ci --quiet 2>&1 | tail -3
  REACT_APP_API_URL="" REACT_APP_API_PORT=80 npm run build
  rsync -a --delete build/ "$INSTALL_DIR/frontend/"
  log "Frontend compilé → $INSTALL_DIR/frontend/"

  chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
}

# =============================================================================
#  SEED BASE DE DONNÉES (première installation uniquement)
# =============================================================================
seed_database() {
  section "Données initiales"
  local user_count
  user_count=$(sudo -u "$APP_USER" node -e "
    require('dotenv').config({ path: '$INSTALL_DIR/backend/.env' });
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count().then(c => { console.log(c); p.\$disconnect(); });
  " 2>/dev/null || echo "0")

  if [[ "$user_count" == "0" ]]; then
    info "Base vide — chargement des données de démo..."
    cd "$INSTALL_DIR/backend"
    sudo -u "$APP_USER" npx ts-node src/scripts/seed.ts
    sudo -u "$APP_USER" npx ts-node src/scripts/seed-step-configs.ts
    log "Données initiales chargées"
  else
    log "$user_count utilisateurs déjà présents — seed ignoré"
  fi
}

# =============================================================================
#  CONFIGURATION NGINX
# =============================================================================
configure_nginx() {
  section "Nginx"
  cat > /etc/nginx/sites-available/optimuscredit <<NGINX
server {
    listen 80;
    server_name ${SERVER_IP};
    client_max_body_size 10m;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options        "SAMEORIGIN" always;
    add_header X-XSS-Protection       "1; mode=block" always;

    root  ${INSTALL_DIR}/frontend;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:5007;
        proxy_http_version 1.1;
        proxy_set_header   Host             \$host;
        proxy_set_header   X-Real-IP        \$remote_addr;
        proxy_set_header   X-Forwarded-For  \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    location ~ /\. { deny all; }
}
NGINX

  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/optimuscredit /etc/nginx/sites-enabled/
  nginx -t
  systemctl enable nginx && systemctl reload nginx
  log "Nginx configuré"
}

# =============================================================================
#  PARE-FEU UFW
# =============================================================================
configure_ufw() {
  section "Pare-feu UFW"
  ufw --force reset > /dev/null
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp comment 'OptimusCredit'
  ufw deny 5007/tcp comment 'Backend (interne uniquement)'
  ufw deny 5432/tcp comment 'PostgreSQL (interne)'
  ufw deny 6379/tcp comment 'Redis (interne)'
  ufw --force enable
  log "Pare-feu configuré"
}

# =============================================================================
#  DÉMARRAGE PM2
# =============================================================================
start_pm2() {
  section "PM2"

  cat > "$INSTALL_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: 'optimuscredit',
    script: '${INSTALL_DIR}/backend/dist/server.js',
    cwd: '${INSTALL_DIR}/backend',
    instances: 2,
    exec_mode: 'cluster',
    user: '${APP_USER}',
    max_memory_restart: '1G',
    error_file: '${LOG_DIR}/error.log',
    out_file: '${LOG_DIR}/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: { NODE_ENV: 'production' }
  }]
};
EOF

  if pm2 list | grep -q optimuscredit; then
    sudo -u "$APP_USER" pm2 reload optimuscredit --update-env
    log "PM2 rechargé (zero-downtime)"
  else
    sudo -u "$APP_USER" pm2 start "$INSTALL_DIR/ecosystem.config.js"
    sudo -u "$APP_USER" pm2 save
    pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true
    log "PM2 démarré et activé au boot"
  fi
}

# =============================================================================
#  MODE MISE À JOUR
# =============================================================================
update_mode() {
  echo -e "${BOLD}${YELLOW}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║      OptimusCredit — Mise à jour Native                  ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  load_config

  backup_database

  deploy_application

  section "Redémarrage PM2 (zero-downtime)"
  if pm2 list | grep -q optimuscredit; then
    sudo -u "$APP_USER" pm2 reload optimuscredit --update-env
    log "PM2 rechargé"
  else
    start_pm2
  fi

  configure_nginx

  final_report
}

# =============================================================================
#  RAPPORT FINAL
# =============================================================================
final_report() {
  echo -e "\n${BOLD}${GREEN}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║            ✅  OptimusCredit opérationnel !              ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}URL d'accès réseau local :${NC}  http://${SERVER_IP}"
  echo -e "  ${BOLD}Test API :${NC}                  curl http://${SERVER_IP}/api/health"
  echo -e "  ${BOLD}Compte admin :${NC}              admin@bank.sn / demo123"
  echo -e "  ${BOLD}Logs PM2 :${NC}                  pm2 logs optimuscredit"
  echo -e "  ${BOLD}Statut services :${NC}           pm2 status"
  echo
  echo -e "  ${BOLD}Pour mettre à jour :${NC}        sudo bash $SCRIPT_DIR/install-native.sh --update"
  echo
}

# =============================================================================
#  POINT D'ENTRÉE
# =============================================================================
echo
if [[ "$MODE" == "update" ]]; then
  update_mode
else
  install_mode
fi
