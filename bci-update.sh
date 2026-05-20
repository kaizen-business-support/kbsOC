#!/usr/bin/env bash
# =============================================================================
#  BCI — Script de mise à jour PRODUCTION (Ubuntu 22.04 · IP locale)
#  Usage : sudo bash bci-update.sh [OPTIONS]
#
#  Options :
#    --branch  <nom>          Branche git à déployer (défaut : branche courante)
#    --skip-pull              Ne pas faire git pull
#    --skip-seed              Ne pas relancer les seeds (TOUS, y compris BCI)
#    --skip-bci-seed          Ne pas relancer uniquement seed-bci.js
#    --force-bci-seed         Forcer seed-bci.js même si des users BCI existent
#                             (écrase les attributs name/role/jobTitle/branch/...
#                             des users BCI hardcodés — à utiliser avec précaution)
#    --with-data-migrations   Relancer aussi migrate-approval-limits / -allowed-actions /
#                             -legal-step-type. Ces scripts UPDATE des données existantes
#                             (plafonds, allowedActions). Désactivés par défaut depuis
#                             que la prod est en place pour préserver les configs custom.
#    --skip-backup            Ne pas faire de backup BDD avant la mise à jour
#
#  Comportement par défaut (post-installation) :
#    - seed-bci.js est skippé automatiquement si des users BCI existent déjà
#    - migrate-* (data) sont skippés sauf si --with-data-migrations
#    - Tout le reste tourne (deps, prisma migrate deploy, build, swap, services)
#
#  Ce script :
#    1.  Vérifie Ubuntu 22.04 + dépendances + root
#    2.  Démarre PostgreSQL, Redis si inactifs
#    3.  Backup automatique de la base (pré-update)
#    4.  git pull
#    5.  npm install (backend + frontend)
#    6.  prisma generate + migrate deploy
#    7.  Compilation backend TypeScript (swap sans interruption)
#    8.  Compilation frontend React    (swap sans interruption)
#    9.  Crée / met à jour les services systemd (démarrage automatique au boot)
#    10. Configure nginx sur l'IP locale
#    11. Redémarre les services + health check
# =============================================================================
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "[ERREUR] Lancez en root : sudo bash bci-update.sh"; exit 1; }

# ─── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${CYAN}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo ""; echo -e "${BLUE}${BOLD}━━━ $* ━━━${NC}"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }

# ─── Arguments ────────────────────────────────────────────────────────────────
GIT_BRANCH=""
SKIP_PULL=false
SKIP_SEED=false
SKIP_BCI_SEED=false
FORCE_BCI_SEED=false
WITH_DATA_MIGRATIONS=false
SKIP_BACKUP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)                GIT_BRANCH="$2"; shift 2 ;;
    --skip-pull)             SKIP_PULL=true;  shift ;;
    --skip-seed)             SKIP_SEED=true;  shift ;;
    --skip-bci-seed)         SKIP_BCI_SEED=true; shift ;;
    --force-bci-seed)        FORCE_BCI_SEED=true; shift ;;
    --with-data-migrations)  WITH_DATA_MIGRATIONS=true; shift ;;
    --skip-backup)           SKIP_BACKUP=true; shift ;;
    *) warn "Argument inconnu ignoré : $1"; shift ;;
  esac
done

# ─── Chemins & constantes ─────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
APP_NAME="optimuscredit"
APP_USER="optimuscredit"
BACKEND_PORT=5007
FRONTEND_PORT=3006
MACHINE_IP=$(hostname -I | awk '{print $1}')

# ─── Bannière ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║   BCI — Mise à jour PRODUCTION · Ubuntu 22.04             ║"
echo "  ║   IP locale : ${MACHINE_IP}                               "
echo "  ║   $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Répertoire : ${CYAN}$APP_DIR${NC}"
echo ""

# =============================================================================
# 1. VÉRIFICATION ENVIRONNEMENT
# =============================================================================
section "1. Vérification de l'environnement"

[[ -f /etc/os-release ]] && source /etc/os-release || die "/etc/os-release introuvable."

[[ "${ID:-}" == "ubuntu" ]] || die "Ubuntu requis. OS détecté : ${PRETTY_NAME:-inconnu}"

UBUNTU_MAJOR=$(echo "${VERSION_ID:-0}" | cut -d. -f1)
if [[ "$UBUNTU_MAJOR" -eq 22 ]]; then
  ok "Ubuntu 22.04 LTS (Jammy)"
elif [[ "$UBUNTU_MAJOR" -ge 22 ]]; then
  warn "Ubuntu ${VERSION_ID} — compatible (22.04 recommandé)"
else
  die "Ubuntu 22.04+ requis — version détectée : ${VERSION_ID:-?}"
fi

[[ -f "$BACKEND_ENV" ]]       || die "backend/.env introuvable. Lancez d'abord install.sh."
[[ -d "$APP_DIR/.git" ]]      || die "$APP_DIR n'est pas un dépôt git."
[[ -f "$APP_DIR/package.json" ]] || die "package.json introuvable dans $APP_DIR."
ok "Structure du projet : OK"

# =============================================================================
# 2. DÉPENDANCES SYSTÈME
# =============================================================================
section "2. Dépendances"

_ensure_pkg() {
  local cmd="$1" pkg="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd : $(${cmd} --version 2>/dev/null | head -1 | awk '{print $NF}' || echo 'OK')"
  else
    warn "$cmd absent — installation..."
    apt-get install -y "$pkg" -qq
    command -v "$cmd" &>/dev/null && ok "$cmd installé" || die "$cmd installation échouée."
  fi
}

# Node.js >= 18
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  ok "Node.js $(node -v)"
else
  warn "Node.js v${NODE_MAJOR} insuffisant — installation Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y nodejs -qq
  NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
  [[ "$NODE_MAJOR" -ge 18 ]] && ok "Node.js $(node -v)" || die "Installation Node.js échouée."
fi

_ensure_pkg git git
_ensure_pkg curl curl
_ensure_pkg nginx nginx
_ensure_pkg psql postgresql-client

# serve (pour distribuer le build React)
if ! command -v serve &>/dev/null; then
  warn "serve absent — installation globale npm..."
  npm install -g serve -q
fi
SERVE_BIN="$(command -v serve)"
ok "serve : $SERVE_BIN"

# Utilisateur système dédié
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/bash \
          --home-dir "$APP_DIR" --no-create-home \
          --comment "BCI OptimusCredit Service" "$APP_USER"
  ok "Utilisateur système '$APP_USER' créé"
else
  ok "Utilisateur '$APP_USER' : existant"
fi
usermod -aG www-data "$APP_USER" 2>/dev/null || true

# =============================================================================
# 3. SERVICES PRÉ-REQUIS (PostgreSQL + Redis)
# =============================================================================
section "3. Services pré-requis"

# Chargement .env — lecture directe pour gérer les espaces en début/fin de ligne
DB_URL=$(grep -E '^\s*DATABASE_URL\s*=' "$BACKEND_ENV" | head -1 \
  | sed -E 's/^\s*DATABASE_URL\s*=\s*//' | tr -d '[:space:]')
[[ -z "$DB_URL" ]] && die "DATABASE_URL non définie dans $BACKEND_ENV."
export DATABASE_URL="$DB_URL"

DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|' || echo "5432")
DB_NAME_VAL=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER_VAL=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS_VAL=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

# PostgreSQL
if ! systemctl is-active --quiet postgresql; then
  info "Démarrage de PostgreSQL..."
  systemctl start postgresql || die "PostgreSQL ne démarre pas. Consultez : journalctl -u postgresql -n 30"
fi
systemctl enable postgresql --quiet 2>/dev/null || true
ok "PostgreSQL : actif + démarrage auto activé"

# Redis
if ! systemctl is-active --quiet redis-server; then
  info "Démarrage de Redis..."
  systemctl start redis-server || warn "Redis ne démarre pas — vérifiez : journalctl -u redis-server -n 20"
fi
if [[ -f /etc/redis/redis.conf ]]; then
  sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
  systemctl reload redis-server 2>/dev/null || true
fi
systemctl enable redis-server --quiet 2>/dev/null || true
ok "Redis : actif + démarrage auto activé"

# Test connexion DB
info "Test connexion base de données..."
DB_OK=false
for i in {1..5}; do
  if PGPASSWORD="$DB_PASS_VAL" psql \
      -h "$DB_HOST" -p "${DB_PORT:-5432}" \
      -U "$DB_USER_VAL" -d "$DB_NAME_VAL" \
      -c "SELECT 1" &>/dev/null; then
    DB_OK=true; break
  fi
  sleep 1
done
$DB_OK && ok "Connexion DB : OK (${DB_USER_VAL}@${DB_HOST}/${DB_NAME_VAL})" \
  || die "Connexion DB impossible après 5 tentatives. Vérifiez PostgreSQL et backend/.env."

# =============================================================================
# 4. BACKUP PRÉ-UPDATE
# =============================================================================
section "4. Sauvegarde automatique pré-mise à jour"

if [[ "$SKIP_BACKUP" == "true" ]]; then
  warn "--skip-backup activé : sauvegarde ignorée."
else
  BACKUP_DIR="$APP_DIR/backups/pre-update"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

  if command -v pg_dump &>/dev/null && \
     PGPASSWORD="$DB_PASS_VAL" pg_dump \
       -h "$DB_HOST" -p "${DB_PORT:-5432}" \
       -U "$DB_USER_VAL" "$DB_NAME_VAL" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    ok "Backup BDD : $BACKUP_FILE"
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
  else
    warn "Backup non effectué — continuation quand même."
    rm -f "$BACKUP_FILE"
  fi
fi

# =============================================================================
# 5. MISE À JOUR DU CODE SOURCE
# =============================================================================
section "5. Mise à jour du code source"

cd "$APP_DIR"

if [[ "$SKIP_PULL" == "true" ]]; then
  warn "--skip-pull activé : git pull ignoré."
else
  STASHED=false
  STASH_MSG=""
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    STASH_MSG="bci-update auto-stash $(date +%Y%m%d_%H%M%S)"
    warn "Modifications locales détectées — mise en stash : '$STASH_MSG'"
    git stash push -m "$STASH_MSG" 2>/dev/null \
      && STASHED=true || warn "git stash échoué — continuation avec les fichiers locaux."
  fi

  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
  TARGET_BRANCH="${GIT_BRANCH:-$CURRENT_BRANCH}"
  info "Branche cible : $TARGET_BRANCH"

  if git fetch origin "$TARGET_BRANCH" 2>/dev/null; then
    git checkout "$TARGET_BRANCH" 2>/dev/null || true
    git pull origin "$TARGET_BRANCH" 2>/dev/null \
      && ok "Code à jour — commit : $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')" \
      || warn "git pull échoué — continuation avec le code local."
  else
    warn "git fetch échoué (réseau ?) — continuation avec le code local."
  fi

  if [[ "$STASHED" == "true" ]]; then
    if git stash pop 2>/dev/null; then
      info "Stash restauré."
    else
      warn "╔════════════════════════════════════════════════════════════════╗"
      warn "║  CONFLIT lors de git stash pop — vos modifications locales      ║"
      warn "║  sont CONSERVÉES dans le stash (rien n'est perdu).              ║"
      warn "║  Le déploiement continue avec le code de la branche.            ║"
      warn "║                                                                  ║"
      warn "║  Pour récupérer vos modifs après ce script :                    ║"
      warn "║    cd $APP_DIR"
      warn "║    git stash list                # voir le stash : $STASH_MSG"
      warn "║    git stash pop                 # résoudre les conflits        ║"
      warn "╚════════════════════════════════════════════════════════════════╝"
    fi
  fi
fi

# =============================================================================
# 6. DÉPENDANCES NPM
# =============================================================================
section "6. Dépendances npm"

info "Backend..."
cd "$BACKEND_DIR"
npm install --prefer-offline 2>&1 | tail -2
ok "Backend : dépendances à jour"

info "Frontend..."
cd "$APP_DIR"
npm install --prefer-offline 2>&1 | tail -2
ok "Frontend : dépendances à jour"

# =============================================================================
# 7. PRISMA — MIGRATION
# =============================================================================
section "7. Prisma — migration base de données"

cd "$BACKEND_DIR"
export DATABASE_URL="$DB_URL"

info "Génération du client Prisma..."
npx prisma generate 2>&1 | tail -2
ok "Client Prisma généré"

info "Application des migrations..."
# Robuste face à P3005 (DB pré-existante sans table _prisma_migrations) :
# on baseline automatiquement plutôt que de tomber sur `db push --accept-data-loss`
# qui peut silencieusement effacer des colonnes.
migrate_output=$(npx prisma migrate deploy 2>&1)
migrate_rc=$?
echo "$migrate_output" | tail -8

if [[ $migrate_rc -eq 0 ]]; then
  ok "Migrations appliquées (migrate deploy)"
elif echo "$migrate_output" | grep -qE "P3005|database schema is not empty"; then
  warn "P3005 détecté — DB pré-existante sans historique. Baseline automatique en cours…"
  baselined=0
  for m in prisma/migrations/*/; do
    [[ -d "$m" ]] || continue
    name=$(basename "$m")
    if npx prisma migrate resolve --applied "$name" >/dev/null 2>&1; then
      baselined=$((baselined + 1))
    fi
  done
  ok "$baselined migration(s) marquée(s) comme appliquée(s)"

  # Vérifie qu'il n'y a pas de drift résiduel
  status_output=$(npx prisma migrate status 2>&1)
  if echo "$status_output" | grep -qE "Database schema is up to date|in sync"; then
    ok "Schéma Prisma aligné après baseline"
  else
    warn "Drift détecté après baseline — réconciliation idempotente de la dernière migration…"
    # Réconciliation auto : rejoue UNIQUEMENT la dernière migration en SQL brut
    # via 'prisma db execute'. Doit être idempotente (IF NOT EXISTS, etc.)
    # pour ne pas casser si elle a déjà été partiellement appliquée.
    latest_migration_dir=$(ls -d prisma/migrations/*/ 2>/dev/null | sort | tail -1)
    if [[ -n "$latest_migration_dir" && -f "${latest_migration_dir}migration.sql" ]]; then
      latest_name=$(basename "$latest_migration_dir")
      info "  → rejeu de $latest_name (idempotent)"
      if npx prisma db execute --file "${latest_migration_dir}migration.sql" --schema prisma/schema.prisma >/dev/null 2>&1; then
        ok "  Migration $latest_name rejouée"
      else
        warn "  Échec du rejeu — diagnostic manuel requis :"
        warn "    cd $BACKEND_DIR && npx prisma db execute --file ${latest_migration_dir}migration.sql --schema prisma/schema.prisma"
      fi
      # Re-check
      status_output2=$(npx prisma migrate status 2>&1)
      if echo "$status_output2" | grep -qE "Database schema is up to date|in sync"; then
        ok "Schéma Prisma aligné après réconciliation"
      else
        warn "Drift persistant. Si une migration plus ancienne manque, lance :"
        warn "  cd $BACKEND_DIR && npx prisma migrate resolve --rolled-back <migration_name> && npx prisma migrate deploy"
        echo "$status_output2" | tail -6
      fi
    fi
  fi
else
  warn "Migration Prisma en erreur (autre que P3005). Sortie :"
  echo "$migrate_output" | tail -10
  warn "Diagnostic manuel requis. NE PAS lancer 'db push --accept-data-loss' (risque de perte de données)."
fi

info "Migration données multi-tenant..."
node "$BACKEND_DIR/prisma/migrate-tenant.js" 2>&1 | tail -10 \
  && ok "Migration multi-tenant : OK" \
  || warn "migrate-tenant.js : erreur non bloquante (données peut-être déjà migrées)"

# Re-grant post-migration
sudo -u postgres psql -d "$DB_NAME_VAL" \
  -c "GRANT ALL ON ALL TABLES    IN SCHEMA public TO ${DB_USER_VAL};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME_VAL" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER_VAL};" 2>/dev/null || true
ok "Privilèges DB accordés"

# Seed
if [[ "$SKIP_SEED" == "true" ]]; then
  warn "--skip-seed activé : aucun seed exécuté."
else
  cd "$BACKEND_DIR"

  # Seeds de référentiels — toujours idempotents, jamais destructeurs.
  # seed-roles : upsert rôles/permissions (référentiel pur)
  # seed-data  : create-if-missing departments & branches
  # seed-policies : create politique seulement si POL-BCI-GENERALE absente
  for seed_file in seed-roles.js seed-data.js seed-policies.js; do
    if [[ -f "$BACKEND_DIR/prisma/$seed_file" ]]; then
      node "$BACKEND_DIR/prisma/$seed_file" \
        && ok "Seed $seed_file : OK" \
        || warn "$seed_file : erreur non bloquante"
    fi
  done

  # seed-bci.js — décision conditionnelle :
  # - --skip-bci-seed       → skip explicite
  # - --force-bci-seed      → exécution forcée (écrase les attributs BCI)
  # - sinon, on regarde si des users BCI existent déjà : si oui, skip auto.
  RUN_BCI_SEED=true
  if [[ "$SKIP_BCI_SEED" == "true" ]]; then
    RUN_BCI_SEED=false
    info "seed-bci.js : skip explicite (--skip-bci-seed)"
  elif [[ "$FORCE_BCI_SEED" == "true" ]]; then
    warn "seed-bci.js : exécution forcée (--force-bci-seed) — les attributs (name, role, jobTitle, branch, department, permissions, isActive) des users BCI hardcodés vont être réinitialisés."
  else
    EXISTING_BCI_USERS=$(PGPASSWORD="$DB_PASS_VAL" psql \
      -h "$DB_HOST" -p "${DB_PORT:-5432}" \
      -U "$DB_USER_VAL" -d "$DB_NAME_VAL" -tAc \
      "SELECT count(*) FROM users WHERE email LIKE '%@bci.sn'" 2>/dev/null \
      | tr -d '[:space:]' || echo "0")
    if [[ "${EXISTING_BCI_USERS:-0}" -gt 0 ]]; then
      RUN_BCI_SEED=false
      info "seed-bci.js : skippé automatiquement (${EXISTING_BCI_USERS} users BCI déjà présents)"
      info "  → Pour ré-écrire leurs attributs : sudo bash bci-update.sh --force-bci-seed"
    fi
  fi

  if [[ "$RUN_BCI_SEED" == "true" && -f "$BACKEND_DIR/prisma/seed-bci.js" ]]; then
    node "$BACKEND_DIR/prisma/seed-bci.js" \
      && ok "Seed seed-bci.js : OK" \
      || warn "seed-bci.js : erreur non bloquante"
  fi
fi

# Migrations de données — UPDATE des données existantes (plafonds, allowedActions,
# stepType juridiques). Désactivées par défaut depuis que la prod est en place :
# si BCI a personnalisé ses plafonds via l'UI, ces scripts les écraseraient.
if [[ "$WITH_DATA_MIGRATIONS" == "true" ]]; then
  warn "Migrations de données activées (--with-data-migrations) — les plafonds, allowedActions et stepType juridiques vont être réinitialisés aux valeurs des scripts."
  cd "$BACKEND_DIR"
  for migrate_file in migrate-approval-limits.js migrate-allowed-actions.js migrate-legal-step-type.js; do
    if [[ -f "$BACKEND_DIR/prisma/$migrate_file" ]]; then
      node "$BACKEND_DIR/prisma/$migrate_file" 2>&1 | tail -5 \
        && ok "$migrate_file : OK" \
        || warn "$migrate_file : erreur non bloquante"
    fi
  done
else
  info "Migrations de données idempotentes skippées (préserve les configs custom : plafonds, allowedActions…)"
  info "  → Pour les rejouer : sudo bash bci-update.sh --with-data-migrations"
fi

# Vider le cache Redis
redis-cli DEL cache:departments:active cache:branches:active 2>/dev/null \
  && ok "Cache Redis invalidé" || true

# =============================================================================
# 8. COMPILATION BACKEND (TypeScript → dist, swap sans interruption)
# =============================================================================
section "8. Compilation backend (TypeScript)"

cd "$BACKEND_DIR"
rm -rf dist_new
info "Compilation TypeScript..."
npx tsc --outDir dist_new 2>&1 | tail -3
ok "Backend compilé → dist_new/"

# =============================================================================
# 9. COMPILATION FRONTEND (React → build, swap sans interruption)
# =============================================================================
section "9. Compilation frontend (React)"

cd "$APP_DIR"
BUILD_TMP="$APP_DIR/build_new"
rm -rf "$BUILD_TMP"

# Forcer l'URL API vers l'IP locale
REACT_APP_API_PORT=$(grep -E '^REACT_APP_API_PORT=' .env 2>/dev/null | cut -d= -f2 || echo "$BACKEND_PORT")
export REACT_APP_API_PORT
export CI=false   # warnings non bloquants

info "Build React (CI=false)..."
BUILD_PATH="$BUILD_TMP" npm run build 2>&1 | tail -3
ok "Frontend compilé → build_new/"

# =============================================================================
# 10. SERVICES SYSTEMD (création ou mise à jour)
# =============================================================================
section "10. Services systemd (démarrage automatique au boot)"

# ── Répertoires runtime ────────────────────────────────────────────────────
mkdir -p "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$BACKEND_DIR/backups"

# ── Service backend ────────────────────────────────────────────────────────
cat > /etc/systemd/system/${APP_NAME}-backend.service <<EOF
[Unit]
Description=BCI OptimusCredit — API Backend (Node.js)
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env

ExecStart=/usr/bin/node ${BACKEND_DIR}/dist/server.js

Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-backend

UMask=007
ReadWritePaths=${BACKEND_DIR}/logs
ReadWritePaths=${BACKEND_DIR}/uploads
ReadWritePaths=${BACKEND_DIR}/backups
ReadWritePaths=${BACKEND_DIR}/prisma
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
ok "Service ${APP_NAME}-backend : défini"

# ── Service frontend ────────────────────────────────────────────────────────
cat > /etc/systemd/system/${APP_NAME}-frontend.service <<EOF
[Unit]
Description=BCI OptimusCredit — Frontend React (serve)
After=network.target ${APP_NAME}-backend.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}

ExecStart=${SERVE_BIN} -s ${APP_DIR}/build -l ${FRONTEND_PORT} --no-clipboard

Restart=always
RestartSec=10

StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}-frontend

UMask=022
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
ok "Service ${APP_NAME}-frontend : défini"

systemctl daemon-reload
systemctl enable "${APP_NAME}-backend"  --quiet
systemctl enable "${APP_NAME}-frontend" --quiet
ok "Démarrage automatique au boot activé pour les deux services"

# =============================================================================
# 11. NGINX — IP LOCALE
# =============================================================================
section "11. nginx — reverse proxy sur IP locale"

cat > /etc/nginx/sites-available/${APP_NAME} <<NGINXEOF
# BCI OptimusCredit — nginx — généré le $(date '+%Y-%m-%d %H:%M')
server {
    listen 80;
    server_name ${MACHINE_IP} _;

    client_max_body_size 50M;
    client_body_timeout  120s;
    server_tokens off;

    add_header X-Frame-Options        "SAMEORIGIN"                      always;
    add_header X-Content-Type-Options "nosniff"                         always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    # ── API Backend ──────────────────────────────────────────────────────────
    location /api {
        proxy_pass            http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version    1.1;
        proxy_set_header      Upgrade           \$http_upgrade;
        proxy_set_header      Connection        "upgrade";
        proxy_set_header      Host              \$host;
        proxy_set_header      X-Real-IP         \$remote_addr;
        proxy_set_header      X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto \$scheme;
        proxy_cache_bypass    \$http_upgrade;
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
    }

    # ── WebSocket ─────────────────────────────────────────────────────────────
    location /socket.io {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         \$http_upgrade;
        proxy_set_header   Connection      "upgrade";
        proxy_set_header   Host            \$host;
        proxy_set_header   X-Real-IP       \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # ── Frontend React ────────────────────────────────────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         \$http_upgrade;
        proxy_set_header   Connection      "upgrade";
        proxy_set_header   Host            \$host;
        proxy_set_header   X-Real-IP       \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /health {
        proxy_pass  http://127.0.0.1:${BACKEND_PORT}/api/health;
        access_log  off;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t || die "Configuration nginx invalide — vérifiez /etc/nginx/sites-available/${APP_NAME}"
ok "nginx configuré sur http://${MACHINE_IP}"

# =============================================================================
# 12. SWAP dist + build → déploiement sans interruption
# =============================================================================
section "12. Déploiement (swap)"

# Backend : swap dist
cd "$BACKEND_DIR"
[[ -d dist ]] && mv dist dist_old
mv dist_new dist
rm -rf dist_old
ok "Backend : dist swappé"

# Frontend : swap build
[[ -d "$APP_DIR/build" ]] && mv "$APP_DIR/build" "$APP_DIR/build_old"
mv "$APP_DIR/build_new" "$APP_DIR/build"
rm -rf "$APP_DIR/build_old"
ok "Frontend : build swappé"

# =============================================================================
# 13. PERMISSIONS
# =============================================================================
section "13. Permissions"

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
find "$APP_DIR" -maxdepth 1 -name "*.sh" -exec chmod 755 {} \;
chmod -R 755 "$BACKEND_DIR/dist"
chmod -R 755 "$APP_DIR/build"
chmod 640 "$BACKEND_DIR/.env" 2>/dev/null || true
for d in "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$BACKEND_DIR/backups"; do
  chmod 770 "$d" && chmod g+s "$d"
done
ok "Permissions appliquées (owner: ${APP_USER})"

# =============================================================================
# 14. REDÉMARRAGE DES SERVICES
# =============================================================================
section "14. Redémarrage des services"

for svc in "${APP_NAME}-backend" "${APP_NAME}-frontend"; do
  systemctl restart "$svc"
  sleep 3
  if systemctl is-active --quiet "$svc"; then
    ok "$svc : actif"
  else
    warn "$svc : pas encore actif — journalctl -u $svc -n 30 --no-pager"
  fi
done

systemctl enable nginx --quiet
systemctl reload nginx && ok "nginx rechargé"

# =============================================================================
# 15. VÉRIFICATION SANTÉ FINALE
# =============================================================================
section "15. Vérification santé"

info "Attente du démarrage (8s)..."
sleep 8

HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${BACKEND_PORT}/api/health" --connect-timeout 8 2>/dev/null || echo "000")
HEALTH_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${FRONTEND_PORT}" --connect-timeout 8 2>/dev/null || echo "000")
HEALTH_NGINX=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://${MACHINE_IP}/api/health" --connect-timeout 8 2>/dev/null || echo "000")

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║      BCI — Déploiement PRODUCTION terminé !               ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

_status() {
  [[ "$1" == "200" ]] && echo -e "${GREEN}✓ HTTP $1${NC}" || echo -e "${YELLOW}⏳ HTTP $1${NC}"
}

echo -e "  ${BOLD}Application   :${NC}  ${CYAN}http://${MACHINE_IP}${NC}"
echo -e "  ${BOLD}API           :${NC}  ${CYAN}http://${MACHINE_IP}/api/health${NC}"
echo ""
echo -e "  ${BOLD}Backend       :${NC}  $(_status "$HEALTH_BACKEND")"
echo -e "  ${BOLD}Frontend      :${NC}  $(_status "$HEALTH_FRONTEND")"
echo -e "  ${BOLD}nginx → app   :${NC}  $(_status "$HEALTH_NGINX")"
echo ""
echo -e "  ${YELLOW}${BOLD}Commit déployé :${NC} $(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
echo ""
echo -e "  ${YELLOW}${BOLD}Services (démarrent automatiquement au boot) :${NC}"
echo "    systemctl status  ${APP_NAME}-backend"
echo "    systemctl status  ${APP_NAME}-frontend"
echo "    systemctl status  postgresql"
echo "    systemctl status  redis-server"
echo "    systemctl status  nginx"
echo ""
echo -e "  ${YELLOW}${BOLD}Logs :${NC}"
echo "    journalctl -u ${APP_NAME}-backend  -f --no-pager"
echo "    journalctl -u ${APP_NAME}-frontend -f --no-pager"
echo ""
echo -e "  ${YELLOW}${BOLD}Prochaine mise à jour :${NC}"
echo "    sudo bash bci-update.sh                          # déploiement standard (non destructif)"
echo "    sudo bash bci-update.sh --branch <branche>       # déployer une branche précise"
echo "    sudo bash bci-update.sh --skip-pull --skip-seed  # déploiement code uniquement"
echo "    sudo bash bci-update.sh --force-bci-seed         # ré-écrire les attributs des users BCI"
echo "    sudo bash bci-update.sh --with-data-migrations   # re-synchroniser plafonds & allowedActions"
echo ""

# Avertissement si backend non disponible
if [[ "$HEALTH_BACKEND" != "200" ]]; then
  warn "Backend non disponible — il démarre peut-être encore."
  warn "Vérifiez : journalctl -u ${APP_NAME}-backend -n 50 --no-pager"
  exit 1
fi
