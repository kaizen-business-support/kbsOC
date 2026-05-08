#!/bin/bash
# ============================================================
#  OptimusCredit — Script de mise à jour (zéro interruption)
#  Usage : sudo ./update.sh [--branch <branche>] [--skip-pull]
#
#  Ce script met à jour l'application sans arrêter les services
#  pendant la compilation. Les services ne sont redémarrés qu'au
#  moment du swap (quelques secondes max).
# ============================================================
set -e

# --- Couleurs ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()      { echo -e "${GREEN}[+]${NC} $1"; }
warn()     { echo -e "${YELLOW}[!]${NC} $1"; }
error()    { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }
section()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
dep_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
dep_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
dep_fail() { echo -e "  ${RED}✗${NC} $1"; }

# ─── Vérifications préalables ────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Lancez ce script en root : sudo ./update.sh"
fi
[[ -f /etc/os-release ]] && source /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *"ubuntu"* ]]; then
  error "Ce script requiert Ubuntu (22.04 ou plus récent)."
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV="$APP_DIR/backend/.env"
[[ ! -f "$BACKEND_ENV" ]] && error "Fichier $BACKEND_ENV introuvable. Lancez d'abord install.sh."

# --- Arguments ---
GIT_BRANCH=""
SKIP_PULL=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)    GIT_BRANCH="$2"; shift 2 ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    *) shift ;;
  esac
done

log "=== Mise à jour OptimusCredit ==="
log "Répertoire : $APP_DIR"
log "Heure      : $(date '+%Y-%m-%d %H:%M:%S')"

# ─── 1. Vérification et réparation des dépendances ───────────────────────────
section "Vérification des dépendances"

DEP_ERRORS=0

# ── 1a. Node.js >= 18 ──
NODE_MAJOR=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  dep_ok "Node.js $(node -v)"
else
  dep_warn "Node.js absent ou trop ancien (version : ${NODE_MAJOR:-0}) — installation de Node.js 18"
  apt-get update -qq
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - 2>/dev/null
  apt-get install -y nodejs 2>/dev/null
  NODE_MAJOR=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
  if [[ "$NODE_MAJOR" -ge 18 ]]; then
    dep_ok "Node.js $(node -v) installé"
  else
    dep_fail "Node.js installation échouée"
    (( DEP_ERRORS++ ))
  fi
fi

# ── 1b. npm ──
if command -v npm &>/dev/null; then
  dep_ok "npm $(npm -v)"
else
  dep_warn "npm absent — installation"
  apt-get install -y npm 2>/dev/null || true
  command -v npm &>/dev/null && dep_ok "npm $(npm -v) installé" \
    || { dep_fail "npm installation échouée"; (( DEP_ERRORS++ )); }
fi

# ── 1c. git ──
if command -v git &>/dev/null; then
  dep_ok "git $(git --version | awk '{print $3}')"
else
  dep_warn "git absent — installation"
  apt-get install -y git 2>/dev/null
  command -v git &>/dev/null && dep_ok "git installé" \
    || { dep_fail "git installation échouée"; (( DEP_ERRORS++ )); }
fi

# ── 1d. curl ──
if command -v curl &>/dev/null; then
  dep_ok "curl $(curl --version | head -1 | awk '{print $2}')"
else
  dep_warn "curl absent — installation"
  apt-get install -y curl 2>/dev/null
  command -v curl &>/dev/null && dep_ok "curl installé" \
    || { dep_fail "curl installation échouée"; (( DEP_ERRORS++ )); }
fi

# ── 1e. python3 (pour pg_hba.conf si besoin) ──
if command -v python3 &>/dev/null; then
  dep_ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
  dep_warn "python3 absent — installation"
  apt-get install -y python3 2>/dev/null
  command -v python3 &>/dev/null && dep_ok "python3 installé" \
    || dep_warn "python3 indisponible — certaines opérations pg_hba peuvent échouer"
fi

# ── 1f. psql + pg_dump (postgresql-client) ──
PSQL_OK=true
PG_DUMP_OK=true
if command -v psql &>/dev/null; then
  dep_ok "psql $(psql --version | awk '{print $3}')"
else
  dep_warn "psql absent — installation de postgresql-client"
  apt-get update -qq
  apt-get install -y postgresql-client-15 2>/dev/null \
    || apt-get install -y postgresql-client 2>/dev/null || true
  command -v psql &>/dev/null && dep_ok "psql installé" \
    || { dep_fail "psql installation échouée"; PSQL_OK=false; (( DEP_ERRORS++ )); }
fi
if command -v pg_dump &>/dev/null; then
  dep_ok "pg_dump $(pg_dump --version | awk '{print $3}')"
else
  dep_warn "pg_dump absent — installation de postgresql-client"
  apt-get install -y postgresql-client-15 2>/dev/null \
    || apt-get install -y postgresql-client 2>/dev/null || true
  command -v pg_dump &>/dev/null && dep_ok "pg_dump installé" \
    || { dep_warn "pg_dump indisponible — backup BDD désactivé"; PG_DUMP_OK=false; }
fi

# ── 1g. serve (serveur de fichiers statiques React) ──
if command -v serve &>/dev/null; then
  dep_ok "serve $(serve --version 2>/dev/null || echo 'installé')"
else
  dep_warn "serve absent — installation globale npm"
  npm install -g serve 2>/dev/null
  command -v serve &>/dev/null && dep_ok "serve installé" \
    || { dep_fail "serve installation échouée — le service frontend ne démarrera pas"; (( DEP_ERRORS++ )); }
fi

# ── 1h. nginx ──
if command -v nginx &>/dev/null; then
  dep_ok "nginx $(nginx -v 2>&1 | grep -oP '[\d.]+')"
else
  dep_warn "nginx absent — installation"
  apt-get install -y nginx 2>/dev/null
  command -v nginx &>/dev/null && dep_ok "nginx installé" \
    || { dep_fail "nginx installation échouée"; (( DEP_ERRORS++ )); }
fi

# ── 1i. openssl ──
if command -v openssl &>/dev/null; then
  dep_ok "openssl $(openssl version | awk '{print $2}')"
else
  dep_warn "openssl absent — installation"
  apt-get install -y openssl 2>/dev/null
  command -v openssl &>/dev/null && dep_ok "openssl installé" \
    || dep_warn "openssl indisponible — opérations cryptographiques limitées"
fi

if [[ "$DEP_ERRORS" -gt 0 ]]; then
  error "${DEP_ERRORS} dépendance(s) critique(s) manquante(s). Corrigez les erreurs ci-dessus."
fi
log "Toutes les dépendances sont satisfaites"

# ─── 2. Services pré-requis (PostgreSQL + Redis) ─────────────────────────────
section "Services pré-requis"

# Chargement du .env — lecture directe pour éviter les problèmes d'espaces
DB_URL=$(grep -E '^\s*DATABASE_URL\s*=' "$BACKEND_ENV" | head -1 | sed -E 's/^\s*DATABASE_URL\s*=\s*//' | tr -d '[:space:]')
[[ -z "$DB_URL" ]] && error "DATABASE_URL non définie dans $BACKEND_ENV."
export DATABASE_URL="$DB_URL"
DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|' || echo "5432")
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

# PostgreSQL
if ! systemctl is-active --quiet postgresql; then
  warn "PostgreSQL inactif — démarrage..."
  systemctl start postgresql \
    || error "Impossible de démarrer PostgreSQL. Vérifiez : journalctl -u postgresql -n 50"
fi
systemctl enable postgresql 2>/dev/null || true
dep_ok "PostgreSQL : actif"

# Redis
if ! systemctl is-active --quiet redis-server; then
  warn "Redis inactif — démarrage..."
  systemctl start redis-server \
    || error "Impossible de démarrer Redis. Vérifiez : journalctl -u redis-server -n 50"
fi
if [[ -f /etc/redis/redis.conf ]]; then
  sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
  systemctl reload redis-server 2>/dev/null || true
fi
systemctl enable redis-server 2>/dev/null || true
dep_ok "Redis : actif"

# Test de connectivité DB
log "Test connexion base de données..."
for i in {1..5}; do
  if PGPASSWORD="$DB_PASS" psql \
      -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT 1" &>/dev/null; then
    dep_ok "Connexion DB : OK (${DB_USER}@${DB_HOST}/${DB_NAME})"
    break
  fi
  [[ $i -eq 5 ]] && error "Impossible de se connecter à la DB après 5 tentatives.
  Vérifiez PostgreSQL et le .env : $BACKEND_ENV"
  sleep 1
done

# ─── 3. Backup de sécurité automatique ──────────────────────────────────────
section "Sauvegarde automatique pré-mise à jour"
BACKUP_DIR="$APP_DIR/backups/pre-update"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

if [[ "$PG_DUMP_OK" == "true" ]] && \
   PGPASSWORD="$DB_PASS" pg_dump \
     -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" "$DB_NAME" \
     2>/dev/null | gzip > "$BACKUP_FILE"; then
  log "Backup BDD : $BACKUP_FILE"
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
else
  warn "Backup BDD non effectué — continuation quand même."
  rm -f "$BACKUP_FILE"
fi

# ─── 4. Mise à jour du code source ──────────────────────────────────────────
section "Mise à jour du code source"
if [[ "$SKIP_PULL" == "true" ]]; then
  warn "--skip-pull activé : mise à jour git ignorée."
else
  cd "$APP_DIR"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "Modifications locales détectées — préservées via git stash."
    git stash push -m "update.sh auto-stash $(date +%Y%m%d_%H%M%S)"
    STASHED=true
  fi

  CURRENT_BRANCH=$(git branch --show-current)
  TARGET_BRANCH="${GIT_BRANCH:-$CURRENT_BRANCH}"
  log "Branche cible : $TARGET_BRANCH"

  git fetch origin "$TARGET_BRANCH" 2>/dev/null \
    || warn "git fetch échoué — réseau indisponible, continue avec le code local."
  git checkout "$TARGET_BRANCH" 2>/dev/null || true
  git pull origin "$TARGET_BRANCH" 2>/dev/null \
    || warn "git pull échoué — continue avec le code local."

  if [[ "${STASHED:-false}" == "true" ]]; then
    git stash pop 2>/dev/null \
      || warn "Conflit stash — résolvez manuellement : git stash pop"
  fi

  log "Code à jour (commit : $(git rev-parse --short HEAD))"
fi

# ─── 5. Dépendances npm backend ─────────────────────────────────────────────
section "Mise à jour des dépendances npm"
cd "$APP_DIR/backend"
npm install --prefer-offline 2>&1 | tail -3
dep_ok "Backend npm : OK"

cd "$APP_DIR"
npm install --prefer-offline 2>&1 | tail -3
dep_ok "Frontend npm : OK"

# ─── 6. Migration Prisma ────────────────────────────────────────────────────
section "Migration base de données (Prisma)"
cd "$APP_DIR/backend"
# Export explicite — plus fiable que set -o allexport pour les sous-processus Prisma
export DATABASE_URL="$DB_URL"
npx prisma generate
npx prisma migrate deploy
dep_ok "Schéma Prisma synchronisé"

# Seed données initiales (idempotent — ne recrée pas si déjà existant)
cd "$APP_DIR/backend"
export DATABASE_URL="$DB_URL"

if [[ -f "$APP_DIR/backend/prisma/seed-roles.js" ]]; then
  node "$APP_DIR/backend/prisma/seed-roles.js" \
    && dep_ok "Rôles système seedés" \
    || warn "seed-roles.js : erreur (non bloquant)"
fi
if [[ -f "$APP_DIR/backend/prisma/seed-data.js" ]]; then
  node "$APP_DIR/backend/prisma/seed-data.js" \
    && dep_ok "Départements et agences seedés" \
    || warn "seed-data.js : erreur (non bloquant)"
fi
if [[ -f "$APP_DIR/backend/prisma/seed-policies.js" ]]; then
  node "$APP_DIR/backend/prisma/seed-policies.js" \
    && dep_ok "Politiques de crédit seedées" \
    || warn "seed-policies.js : erreur (non bloquant)"
fi
if [[ -f "$APP_DIR/backend/prisma/seed-bci.js" ]]; then
  node "$APP_DIR/backend/prisma/seed-bci.js" \
    && dep_ok "Utilisateurs BCI seedés (clients préservés si existants)" \
    || warn "seed-bci.js : erreur (non bloquant)"
fi

# Vider les clés Redis liées aux listes (cache périmé après seed)
redis-cli DEL cache:departments:active cache:branches:active 2>/dev/null \
  && dep_ok "Cache Redis departments/branches vidé" \
  || warn "redis-cli indisponible — cache expirera dans 5 min"

# Re-grant après db push
sudo -u postgres psql -c \
  "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c \
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};" 2>/dev/null || true
dep_ok "Privilèges DB accordés"

# ─── 7. Compilation backend ─────────────────────────────────────────────────
section "Compilation backend (TypeScript)"
cd "$APP_DIR/backend"
rm -rf dist_new
npx tsc --outDir dist_new
dep_ok "Backend compilé → dist_new/"

# ─── 8. Swap + redémarrage backend ──────────────────────────────────────────
section "Déploiement backend"
cd "$APP_DIR/backend"
[[ -d dist ]] && mv dist dist_old
mv dist_new dist
rm -rf dist_old
dep_ok "Swap dist effectué"

chown -R www-data:www-data "$APP_DIR/backend/dist"
systemctl restart optimuscredit-backend
log "Service backend redémarré"

for i in {1..15}; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://127.0.0.1:5007/api/health" 2>/dev/null || echo "000")
  [[ "$HEALTH" == "200" ]] && { dep_ok "Backend en ligne (HTTP 200) après ${i}s"; break; }
  sleep 1
done
[[ "$HEALTH" != "200" ]] && warn "Backend HTTP ${HEALTH} — journalctl -u optimuscredit-backend -n 50"

# ─── 9. Compilation frontend ─────────────────────────────────────────────────
section "Compilation frontend (React)"
cd "$APP_DIR"
BUILD_TMP="$APP_DIR/build_new"
rm -rf "$BUILD_TMP"
REACT_APP_API_PORT=$(grep REACT_APP_API_PORT .env 2>/dev/null | cut -d= -f2 || echo "5007")
export REACT_APP_API_PORT
BUILD_PATH="$BUILD_TMP" npm run build
dep_ok "Frontend compilé → build_new/"

# ─── 10. Swap + redémarrage frontend ─────────────────────────────────────────
section "Déploiement frontend"
[[ -d "$APP_DIR/build" ]] && mv "$APP_DIR/build" "$APP_DIR/build_old"
mv "$BUILD_TMP" "$APP_DIR/build"
rm -rf "$APP_DIR/build_old"
dep_ok "Swap build effectué"

chown -R www-data:www-data "$APP_DIR/build"
systemctl restart optimuscredit-frontend
log "Service frontend redémarré"

# ─── 11. Droits finaux + nginx ────────────────────────────────────────────────
section "Finalisation"
chown -R www-data:www-data "$APP_DIR"
systemctl reload nginx 2>/dev/null || true
dep_ok "Droits et nginx rechargés"

# ─── 12. Vérification santé finale ───────────────────────────────────────────
section "Vérification finale"
sleep 2
HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:5007/api/health" 2>/dev/null || echo "000")
HEALTH_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:3006" 2>/dev/null || echo "000")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   OptimusCredit mis à jour avec succès !     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Backend  :${NC}  HTTP ${HEALTH_BACKEND} \
$([ "$HEALTH_BACKEND" == "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo -e "  ${BLUE}Frontend :${NC}  HTTP ${HEALTH_FRONTEND} \
$([ "$HEALTH_FRONTEND" == "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo ""
echo -e "${YELLOW}  Commit déployé :${NC} $(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
echo ""
echo -e "${YELLOW}  Commandes utiles :${NC}"
echo "    systemctl status optimuscredit-backend"
echo "    systemctl status optimuscredit-frontend"
echo "    journalctl -u optimuscredit-backend  -f --no-pager"
echo "    journalctl -u optimuscredit-frontend -f --no-pager"
echo ""

if [[ "$HEALTH_BACKEND" != "200" ]]; then
  warn "Backend non disponible — consultez les logs ci-dessus."
  exit 1
fi
