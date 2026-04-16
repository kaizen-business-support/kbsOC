#!/usr/bin/env bash
# =============================================================================
#  BCI — Script de mise à jour DEV (Ubuntu 22.04 · mode local)
#  Usage : bash bci-update.sh [--branch <branche>] [--skip-pull] [--skip-seed]
#
#  Ce script met à jour une installation DEV existante sans tout réinstaller :
#    1. Vérifie Ubuntu 22.04 + dépendances
#    2. git pull (code source)
#    3. npm install (backend + frontend)
#    4. prisma generate + migrate
#    5. Redémarre les serveurs dev dans tmux
# =============================================================================
set -euo pipefail

# ─── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${CYAN}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo ""; echo -e "${BLUE}${BOLD}━━━ $* ━━━${NC}"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }
fail()    { echo -e "  ${RED}✗${NC} $1"; }

# ─── Arguments ────────────────────────────────────────────────────────────────
GIT_BRANCH=""
SKIP_PULL=false
SKIP_SEED=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)    GIT_BRANCH="$2"; shift 2 ;;
    --skip-pull) SKIP_PULL=true;  shift ;;
    --skip-seed) SKIP_SEED=true;  shift ;;
    *) warn "Argument inconnu ignoré : $1"; shift ;;
  esac
done

# ─── Chemins ──────────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$APP_DIR/.env"
TMUX_SESSION="optimuscredit"

# ─── Bannière ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║     BCI — Mise à jour DEV · Ubuntu 22.04             ║"
echo "  ║     $(date '+%Y-%m-%d %H:%M:%S')                             ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Répertoire : ${CYAN}$APP_DIR${NC}"
echo ""

# =============================================================================
# 1. VÉRIFICATION UBUNTU 22.04
# =============================================================================
section "1. Vérification de l'environnement"

[[ -f /etc/os-release ]] && source /etc/os-release || die "/etc/os-release introuvable."

if [[ "${ID:-}" != "ubuntu" ]]; then
  die "Ce script requiert Ubuntu. OS détecté : ${PRETTY_NAME:-inconnu}"
fi

UBUNTU_VER="${VERSION_ID:-0}"
UBUNTU_MAJOR=$(echo "$UBUNTU_VER" | cut -d. -f1)

if [[ "$UBUNTU_MAJOR" -eq 22 ]]; then
  ok "Ubuntu 22.04 LTS (Jammy) détecté"
elif [[ "$UBUNTU_MAJOR" -ge 22 ]]; then
  warn "Ubuntu $UBUNTU_VER détecté — compatible mais non testé (22.04 recommandé)"
else
  die "Ubuntu 22.04 requis — version détectée : $UBUNTU_VER"
fi

# Fichiers .env requis
[[ -f "$BACKEND_ENV" ]] || die "backend/.env introuvable. Lancez d'abord setup-dev.sh."
[[ -f "$FRONTEND_ENV" ]] || warn ".env frontend introuvable — continuation quand même."

# Répertoire git
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR n'est pas un dépôt git."
ok "Dépôt git : $APP_DIR"

# =============================================================================
# 2. DÉPENDANCES
# =============================================================================
section "2. Dépendances"

# Node.js >= 18
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  ok "Node.js $(node -v)"
else
  warn "Node.js absent ou trop ancien (v${NODE_MAJOR}) — installation Node.js 20..."
  if [[ $EUID -eq 0 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y nodejs >/dev/null
  else
    die "Node.js v${NODE_MAJOR} insuffisant. Lancez en root ou installez Node.js 20 manuellement."
  fi
  NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
  [[ "$NODE_MAJOR" -ge 18 ]] && ok "Node.js $(node -v) installé" || die "Installation Node.js échouée."
fi

# npm
command -v npm &>/dev/null && ok "npm $(npm -v)" \
  || die "npm introuvable. Réinstallez Node.js."

# git
command -v git &>/dev/null && ok "git $(git --version | awk '{print $3}')" \
  || die "git introuvable : sudo apt-get install -y git"

# tmux
if command -v tmux &>/dev/null; then
  ok "tmux $(tmux -V | awk '{print $2}')"
else
  warn "tmux absent — les serveurs seront lancés en arrière-plan au lieu de tmux."
  TMUX_MISSING=true
fi
TMUX_MISSING="${TMUX_MISSING:-false}"

# PostgreSQL
if command -v psql &>/dev/null; then
  ok "psql $(psql --version | awk '{print $3}')"
else
  warn "psql absent — les migrations Prisma pourraient échouer si la DB est distante."
fi

# Redis
if command -v redis-cli &>/dev/null; then
  if redis-cli ping &>/dev/null; then
    ok "Redis : actif"
  else
    warn "Redis installé mais inactif — tentative de démarrage..."
    if [[ $EUID -eq 0 ]]; then
      systemctl start redis-server 2>/dev/null || true
    else
      sudo systemctl start redis-server 2>/dev/null \
        || warn "Redis inactif — démarrez-le manuellement : sudo systemctl start redis-server"
    fi
  fi
else
  warn "redis-cli absent — installez Redis si nécessaire."
fi

# =============================================================================
# 3. SERVICES PRÉ-REQUIS
# =============================================================================
section "3. Services pré-requis"

# Chargement .env backend
set +u  # permet les variables non définies lors du source
source "$BACKEND_ENV" 2>/dev/null || true
set -u

DB_URL="${DATABASE_URL:-}"
[[ -z "$DB_URL" ]] && die "DATABASE_URL non définie dans $BACKEND_ENV"

DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|' || echo "5432")
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

# PostgreSQL
PG_ACTIVE=false
if systemctl is-active --quiet postgresql 2>/dev/null; then
  PG_ACTIVE=true
  ok "PostgreSQL : actif"
else
  info "Démarrage de PostgreSQL..."
  if [[ $EUID -eq 0 ]]; then
    systemctl start postgresql 2>/dev/null && PG_ACTIVE=true \
      || warn "Impossible de démarrer PostgreSQL — vérifiez manuellement."
  else
    sudo systemctl start postgresql 2>/dev/null && PG_ACTIVE=true \
      || warn "Impossible de démarrer PostgreSQL — essayez : sudo systemctl start postgresql"
  fi
  $PG_ACTIVE && ok "PostgreSQL démarré" || warn "PostgreSQL inactif — les migrations échoueront peut-être."
fi

# Test connexion DB
if $PG_ACTIVE && command -v psql &>/dev/null; then
  DB_CONN=false
  for i in {1..3}; do
    if PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" -p "${DB_PORT:-5432}" \
        -U "$DB_USER" -d "$DB_NAME" \
        -c "SELECT 1" &>/dev/null; then
      DB_CONN=true; break
    fi
    sleep 1
  done
  $DB_CONN && ok "Connexion DB : OK (${DB_USER}@${DB_HOST}/${DB_NAME})" \
    || warn "Connexion DB échouée — les migrations Prisma pourraient échouer."
fi

# =============================================================================
# 4. MISE À JOUR DU CODE
# =============================================================================
section "4. Mise à jour du code source"

cd "$APP_DIR"

if [[ "$SKIP_PULL" == "true" ]]; then
  warn "--skip-pull activé : git pull ignoré."
else
  # Sauvegarder les modifications locales si besoin
  STASHED=false
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    warn "Modifications locales détectées — mise en stash..."
    git stash push -m "bci-update auto-stash $(date +%Y%m%d_%H%M%S)" 2>/dev/null \
      && STASHED=true \
      || warn "git stash échoué — continuons avec les fichiers modifiés."
  fi

  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
  TARGET_BRANCH="${GIT_BRANCH:-$CURRENT_BRANCH}"
  info "Branche : $TARGET_BRANCH"

  if git fetch origin "$TARGET_BRANCH" 2>/dev/null; then
    git checkout "$TARGET_BRANCH" 2>/dev/null || true
    if git pull origin "$TARGET_BRANCH" 2>/dev/null; then
      ok "Code à jour — commit : $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
    else
      warn "git pull échoué — continuation avec le code local."
    fi
  else
    warn "git fetch échoué (réseau ?) — continuation avec le code local."
  fi

  if [[ "$STASHED" == "true" ]]; then
    git stash pop 2>/dev/null \
      && info "Stash restauré." \
      || warn "Conflit stash — résolvez manuellement : git stash pop"
  fi
fi

# =============================================================================
# 5. DÉPENDANCES NPM
# =============================================================================
section "5. Dépendances npm"

info "Backend..."
cd "$BACKEND_DIR"
npm install --prefer-offline 2>&1 | tail -2
ok "Backend : dépendances à jour"

info "Frontend..."
cd "$APP_DIR"
npm install --prefer-offline 2>&1 | tail -2
ok "Frontend : dépendances à jour"

# =============================================================================
# 6. PRISMA — GÉNÉRATION + MIGRATION
# =============================================================================
section "6. Prisma — migration base de données"

cd "$BACKEND_DIR"
export DATABASE_URL="$DB_URL"

info "Génération du client Prisma..."
npx prisma generate 2>&1 | tail -2
ok "Client Prisma généré"

info "Application des migrations..."
if npx prisma migrate deploy 2>/dev/null; then
  ok "Migrations Prisma appliquées (migrate deploy)"
else
  warn "migrate deploy non disponible — db push en fallback..."
  npx prisma db push --accept-data-loss 2>/dev/null \
    && ok "Schéma Prisma synchronisé (db push)" \
    || warn "Prisma db push échoué — vérifiez la connexion DB."
fi

# Re-grant post-migration (en cas de nouvelles tables)
if [[ $EUID -eq 0 ]]; then
  sudo -u postgres psql -d "$DB_NAME" \
    -c "GRANT ALL ON ALL TABLES    IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
  sudo -u postgres psql -d "$DB_NAME" \
    -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
  ok "Privilèges DB post-migration accordés"
else
  sudo -n postgres psql -d "$DB_NAME" \
    -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>/dev/null \
    || info "Re-grant DB ignoré (non-root) — utilisez 'sudo bash bci-update.sh' si des migrations ont créé de nouvelles tables."
fi

# Seed (uniquement si demandé ou si nouveau déploiement)
if [[ "$SKIP_SEED" == "false" ]]; then
  if [[ -f "$BACKEND_DIR/prisma/seed-roles.js" ]]; then
    node "$BACKEND_DIR/prisma/seed-roles.js" 2>/dev/null \
      && ok "Seed rôles : OK" \
      || warn "seed-roles.js : erreur non bloquante"
  fi
  if [[ -f "$BACKEND_DIR/prisma/seed-data.js" ]]; then
    node "$BACKEND_DIR/prisma/seed-data.js" 2>/dev/null \
      && ok "Seed données : OK" \
      || warn "seed-data.js : erreur non bloquante"
  fi
fi

# Vider le cache Redis des listes
redis-cli DEL cache:departments:active cache:branches:active 2>/dev/null \
  && ok "Cache Redis invalidé" \
  || info "redis-cli indisponible — le cache expirera automatiquement."

# =============================================================================
# 7. REDÉMARRAGE DES SERVEURS DEV
# =============================================================================
section "7. Redémarrage des serveurs DEV"

BACKEND_PORT="${PORT:-5007}"
FRONTEND_PORT=3006

# Tuer les processus existants sur les ports
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  pid=$(lsof -ti ":$port" 2>/dev/null || fuser "$port/tcp" 2>/dev/null || echo "")
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null && info "Port $port libéré (PID $pid)" || true
    sleep 1
  fi
done

if [[ "$TMUX_MISSING" == "false" ]] && command -v tmux &>/dev/null; then
  # Redémarrage dans tmux
  if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    info "Session tmux '$TMUX_SESSION' existante — redémarrage des fenêtres..."

    # Fenêtre backend
    tmux send-keys -t "${TMUX_SESSION}:backend" "" ENTER 2>/dev/null || true
    tmux send-keys -t "${TMUX_SESSION}:backend" \
      "cd ${BACKEND_DIR} && DATABASE_URL='${DB_URL}' npm run dev 2>&1 | tee logs/dev.log" ENTER \
      2>/dev/null || true

    # Fenêtre frontend
    tmux send-keys -t "${TMUX_SESSION}:frontend" "" ENTER 2>/dev/null || true
    tmux send-keys -t "${TMUX_SESSION}:frontend" \
      "cd ${APP_DIR} && npm start 2>&1 | tee /tmp/frontend-dev.log" ENTER \
      2>/dev/null || true

    ok "Serveurs relancés dans la session tmux '${TMUX_SESSION}'"
    info "Accédez aux logs : tmux attach -t ${TMUX_SESSION}"
  else
    info "Création d'une nouvelle session tmux '${TMUX_SESSION}'..."

    tmux new-session -d -s "$TMUX_SESSION" -n backend
    tmux send-keys -t "${TMUX_SESSION}:backend" \
      "cd ${BACKEND_DIR} && DATABASE_URL='${DB_URL}' npm run dev 2>&1 | tee logs/dev.log" ENTER

    tmux new-window -t "$TMUX_SESSION" -n frontend
    tmux send-keys -t "${TMUX_SESSION}:frontend" \
      "cd ${APP_DIR} && npm start 2>&1 | tee /tmp/frontend-dev.log" ENTER

    ok "Serveurs démarrés dans la session tmux '${TMUX_SESSION}'"
    info "Accédez aux logs : tmux attach -t ${TMUX_SESSION}"
  fi
else
  # Fallback sans tmux : démarrage en arrière-plan
  warn "tmux absent — démarrage des serveurs en arrière-plan."

  mkdir -p "$BACKEND_DIR/logs"
  cd "$BACKEND_DIR"
  DATABASE_URL="$DB_URL" nohup npm run dev > logs/dev.log 2>&1 &
  BACKEND_PID=$!
  ok "Backend démarré (PID $BACKEND_PID) — logs : $BACKEND_DIR/logs/dev.log"

  cd "$APP_DIR"
  nohup npm start > /tmp/frontend-dev.log 2>&1 &
  FRONTEND_PID=$!
  ok "Frontend démarré (PID $FRONTEND_PID) — logs : /tmp/frontend-dev.log"
fi

# =============================================================================
# 8. VÉRIFICATION SANTÉ
# =============================================================================
section "8. Vérification santé"

info "Attente du démarrage (10s)..."
sleep 10

HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${BACKEND_PORT}/api/health" --connect-timeout 5 2>/dev/null || echo "000")

MACHINE_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║      BCI — Mise à jour DEV terminée !                ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${BOLD}Application  :${NC}  ${CYAN}http://${MACHINE_IP}${NC}"
echo -e "  ${BOLD}Backend API  :${NC}  ${CYAN}http://${MACHINE_IP}:${BACKEND_PORT}/api/health${NC}"
echo ""
echo -e "  ${BOLD}Backend HTTP :${NC}  ${HEALTH_BACKEND} \
$([ "$HEALTH_BACKEND" == "200" ] && echo -e "${GREEN}✓ en ligne${NC}" || echo -e "${YELLOW}⏳ démarrage en cours…${NC}")"
echo ""
echo -e "  ${YELLOW}${BOLD}Commit déployé :${NC} $(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
echo ""

if command -v tmux &>/dev/null && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  echo -e "  ${YELLOW}${BOLD}Logs en direct :${NC}"
  echo "    tmux attach -t ${TMUX_SESSION}          (toutes les fenêtres)"
  echo "    tmux attach -t ${TMUX_SESSION}:backend   (logs backend)"
  echo "    tmux attach -t ${TMUX_SESSION}:frontend  (logs frontend)"
  echo "    Quitter tmux : Ctrl+B puis D"
else
  echo -e "  ${YELLOW}${BOLD}Logs :${NC}"
  echo "    Backend  : tail -f ${BACKEND_DIR}/logs/dev.log"
  echo "    Frontend : tail -f /tmp/frontend-dev.log"
fi

echo ""
echo -e "  ${YELLOW}${BOLD}Commandes utiles :${NC}"
echo "    bash bci-update.sh                   # re-mise à jour"
echo "    bash bci-update.sh --skip-pull       # sans git pull"
echo "    bash bci-update.sh --skip-seed       # sans re-seed"
echo "    bash bci-update.sh --branch feature  # branche spécifique"
echo ""

if [[ "$HEALTH_BACKEND" != "200" ]]; then
  warn "Backend pas encore disponible — il démarre peut-être encore. Vérifiez les logs."
fi
