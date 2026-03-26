#!/usr/bin/env bash
# =============================================================================
# OptimusCredit v2.0 — Script d'installation développement macOS
# =============================================================================
# Usage:
#   chmod +x install-dev-mac.sh
#   ./install-dev-mac.sh [--db-password <password>] [--skip-brew] [--skip-db]
# =============================================================================

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Configuration ─────────────────────────────────────────────────────────────
DB_NAME="optimus_credit"
DB_USER="optimus"
DB_PASSWORD="dev_password_123"
DB_PORT="5432"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"
NODE_REQUIRED="18"

SKIP_BREW=false
SKIP_DB=false

# ── Arguments ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-password) DB_PASSWORD="$2"; shift 2 ;;
    --skip-brew)   SKIP_BREW=true; shift ;;
    --skip-db)     SKIP_DB=true; shift ;;
    *) echo -e "${RED}Option inconnue: $1${NC}"; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[✓]${NC} $*"; }
info()    { echo -e "${BLUE}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; }
section() { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }
die()     { error "$*"; exit 1; }

# ── Bannière ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat <<'EOF'
  ___        _   _                      ____              _ _ _
 / _ \ _ __ | |_(_)_ __ ___  _   _ ___ / ___|_ __ ___  __| (_) |_
| | | | '_ \| __| | '_ ` _ \| | | / __| |   | '__/ _ \/ _` | | __|
| |_| | |_) | |_| | | | | | | |_| \__ \ |___| | |  __/ (_| | | |_
 \___/| .__/ \__|_|_| |_| |_|\__,_|___/\____|_|  \___|\__,_|_|\__|
      |_|
              Installation Développement macOS — v2.0
EOF
echo -e "${NC}"
echo -e "  ${YELLOW}Projet :${NC} OptimusCredit — Plateforme d'Analyse de Crédit"
echo -e "  ${YELLOW}Cible  :${NC} macOS (Apple Silicon & Intel)"
echo -e "  ${YELLOW}Mode   :${NC} Développement local\n"

# ── 1. Vérification macOS ─────────────────────────────────────────────────────
section "Vérification de l'environnement"

if [[ "$(uname)" != "Darwin" ]]; then
  die "Ce script est réservé à macOS."
fi

MACOS_VERSION=$(sw_vers -productVersion)
info "macOS détecté : $MACOS_VERSION"

ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  info "Architecture : Apple Silicon (arm64)"
  HOMEBREW_PREFIX="/opt/homebrew"
else
  info "Architecture : Intel (x86_64)"
  HOMEBREW_PREFIX="/usr/local"
fi

# Xcode Command Line Tools
if ! xcode-select -p &>/dev/null; then
  warn "Xcode Command Line Tools manquants — installation..."
  xcode-select --install
  echo "Relancez ce script après l'installation des Xcode CLT."
  exit 0
fi
log "Xcode Command Line Tools OK"

# ── 2. Homebrew ───────────────────────────────────────────────────────────────
section "Homebrew"

if $SKIP_BREW; then
  warn "--skip-brew : vérification Homebrew ignorée."
else
  if ! command -v brew &>/dev/null; then
    info "Installation de Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Ajouter Homebrew au PATH pour la session courante
    if [[ "$ARCH" == "arm64" ]]; then
      eval "$($HOMEBREW_PREFIX/bin/brew shellenv)"
    fi
  else
    log "Homebrew $(brew --version | head -1) déjà installé"
    info "Mise à jour de Homebrew..."
    brew update --quiet
  fi
fi

# ── 3. Node.js ────────────────────────────────────────────────────────────────
section "Node.js"

install_node() {
  info "Installation de Node.js via Homebrew..."
  brew install node@${NODE_REQUIRED}
  brew link node@${NODE_REQUIRED} --force --overwrite
  # Ajouter au PATH
  echo "export PATH=\"$HOMEBREW_PREFIX/opt/node@${NODE_REQUIRED}/bin:\$PATH\"" >> ~/.zshrc
  export PATH="$HOMEBREW_PREFIX/opt/node@${NODE_REQUIRED}/bin:$PATH"
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VERSION" -ge "$NODE_REQUIRED" ]]; then
    log "Node.js $(node -v) OK"
  else
    warn "Node.js $(node -v) trop ancien (>= v${NODE_REQUIRED} requis)"
    install_node
  fi
else
  install_node
fi

log "node : $(node -v)"
log "npm  : $(npm -v)"

# ── 4. PostgreSQL ─────────────────────────────────────────────────────────────
section "PostgreSQL"

if $SKIP_DB; then
  warn "--skip-db : installation PostgreSQL ignorée."
else
  if ! brew list postgresql@15 &>/dev/null 2>&1; then
    info "Installation de PostgreSQL 15..."
    brew install postgresql@15
  else
    log "PostgreSQL 15 déjà installé"
  fi

  # Lien et PATH
  brew link postgresql@15 --force --overwrite 2>/dev/null || true
  export PATH="$HOMEBREW_PREFIX/opt/postgresql@15/bin:$PATH"

  # Démarrage du service
  if ! brew services list | grep "postgresql@15" | grep -q "started"; then
    info "Démarrage de PostgreSQL..."
    brew services start postgresql@15
    sleep 3
  else
    log "PostgreSQL déjà en cours d'exécution"
  fi

  # Vérification de la connexion
  RETRIES=10
  until pg_isready -q -h localhost -p $DB_PORT 2>/dev/null || [[ $RETRIES -eq 0 ]]; do
    sleep 1
    ((RETRIES--))
  done
  [[ $RETRIES -eq 0 ]] && die "PostgreSQL ne répond pas sur le port $DB_PORT"
  log "PostgreSQL prêt sur le port $DB_PORT"

  # Création de l'utilisateur et de la base
  info "Configuration de la base de données..."

  # Utilisateur
  if psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
    warn "Utilisateur '$DB_USER' déjà existant — mise à jour du mot de passe"
    psql postgres -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" > /dev/null
  else
    psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" > /dev/null
    log "Utilisateur '$DB_USER' créé"
  fi

  # Base de données
  if psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
    warn "Base de données '$DB_NAME' déjà existante"
  else
    psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null
    log "Base de données '$DB_NAME' créée"
  fi

  # Privilèges
  psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null
  psql $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" > /dev/null 2>&1 || true
  log "Privilèges accordés à '$DB_USER'"
fi

# ── 5. Redis ──────────────────────────────────────────────────────────────────
section "Redis"

if ! brew list redis &>/dev/null 2>&1; then
  info "Installation de Redis..."
  brew install redis
else
  log "Redis déjà installé"
fi

if ! brew services list | grep "redis" | grep -q "started"; then
  info "Démarrage de Redis..."
  brew services start redis
  sleep 2
else
  log "Redis déjà en cours d'exécution"
fi

if redis-cli ping &>/dev/null; then
  log "Redis prêt ($(redis-cli --version))"
else
  warn "Redis ne répond pas — il sera peut-être utile de le démarrer manuellement"
fi

# ── 6. Dépendances du projet ───────────────────────────────────────────────────
section "Dépendances NPM"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

info "Installation des dépendances frontend..."
npm install --legacy-peer-deps

info "Installation des dépendances backend..."
cd backend
npm install
cd ..

log "Toutes les dépendances installées"

# ── 7. Fichiers d'environnement ───────────────────────────────────────────────
section "Configuration de l'environnement"

# ── Frontend .env ──
FRONTEND_ENV="$SCRIPT_DIR/.env"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  cat > "$FRONTEND_ENV" <<EOF
REACT_APP_API_PORT=$BACKEND_PORT
HOST=127.0.0.1
PORT=$FRONTEND_PORT
REACT_APP_ENV=development
EOF
  log "Fichier frontend .env créé"
else
  warn "Frontend .env déjà existant — conservé tel quel"
fi

# ── Backend .env ──
BACKEND_ENV="$SCRIPT_DIR/backend/.env"
if [[ ! -f "$BACKEND_ENV" ]]; then
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)

  cat > "$BACKEND_ENV" <<EOF
# Base de données
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME?schema=public"

# Authentification JWT
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
JWT_EXPIRY="1h"
JWT_REFRESH_EXPIRY="7d"

# Serveur
NODE_ENV="development"
PORT="$BACKEND_PORT"
API_BASE_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

# Upload de fichiers
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="10485760"
ALLOWED_FILE_TYPES="pdf,png,jpg,jpeg,xlsx,xls,doc,docx"

# Email (optionnel — laisser vide en dev)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="OptimusCredit <noreply@dev.local>"

# Sécurité
BCRYPT_ROUNDS="10"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="500"

# CORS
ALLOWED_ORIGINS="http://localhost:$FRONTEND_PORT,http://localhost:$BACKEND_PORT"

# Logs
LOG_LEVEL="debug"
LOG_FILE="logs/app.log"

# Redis
REDIS_URL="redis://127.0.0.1:6379"

# OCR (optionnel)
OCR_SERVICE_ENABLED="false"
OCR_SERVICE_URL="http://localhost:3002"

# Azure AD (optionnel)
AZURE_TENANT_ID=""
AZURE_CLIENT_ID=""
AZURE_CLIENT_SECRET=""

# Flags de développement
ENABLE_API_DOCS="true"
ENABLE_SEED_DATA="true"
DISABLE_AUTH_FOR_TESTING="false"
EOF
  log "Fichier backend .env créé avec des secrets JWT générés aléatoirement"
else
  warn "Backend .env déjà existant — conservé tel quel"
fi

# ── 8. Prisma : migrations & seed ─────────────────────────────────────────────
section "Base de données (Prisma)"

if $SKIP_DB; then
  warn "--skip-db : migrations Prisma ignorées."
else
  cd "$SCRIPT_DIR/backend"

  # Exporter DATABASE_URL pour Prisma
  export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME?schema=public"

  info "Génération du client Prisma..."
  npx prisma generate

  info "Application des migrations..."
  npx prisma migrate deploy 2>/dev/null || {
    warn "migrate deploy a échoué — tentative avec migrate dev..."
    npx prisma migrate dev --name "init" --skip-seed
  }

  info "Seeding de la base de données..."
  npx prisma db seed 2>/dev/null || warn "Seed ignoré (script non défini ou déjà exécuté)"

  log "Base de données prête"
  cd "$SCRIPT_DIR"
fi

# ── 9. Répertoires nécessaires ─────────────────────────────────────────────────
section "Répertoires"

mkdir -p "$SCRIPT_DIR/backend/uploads"
mkdir -p "$SCRIPT_DIR/backend/logs"
mkdir -p "$SCRIPT_DIR/backend/backups"
log "Répertoires uploads/, logs/, backups/ créés"

# ── 10. Résumé & instructions de démarrage ────────────────────────────────────
section "Installation terminée"

echo ""
echo -e "${BOLD}${GREEN}  OptimusCredit est prêt pour le développement !${NC}"
echo ""
echo -e "${BOLD}  Accès :${NC}"
echo -e "    Frontend  →  http://localhost:${FRONTEND_PORT}"
echo -e "    Backend   →  http://localhost:${BACKEND_PORT}"
echo -e "    API Docs  →  http://localhost:${BACKEND_PORT}/api-docs"
echo ""
echo -e "${BOLD}  Base de données :${NC}"
echo -e "    Hôte     : localhost:${DB_PORT}"
echo -e "    Base     : ${DB_NAME}"
echo -e "    Utilisateur : ${DB_USER}"
echo -e "    Mot de passe : ${DB_PASSWORD}"
echo ""
echo -e "${BOLD}  Services macOS (Homebrew) :${NC}"
echo -e "    PostgreSQL → brew services start postgresql@15"
echo -e "    Redis      → brew services start redis"
echo -e "    Arrêter    → brew services stop postgresql@15 redis"
echo ""
echo -e "${BOLD}  Démarrage du projet :${NC}"
echo ""
echo -e "    ${CYAN}# Terminal 1 — Backend${NC}"
echo -e "    cd backend && npm run dev"
echo ""
echo -e "    ${CYAN}# Terminal 2 — Frontend${NC}"
echo -e "    npm start"
echo ""
echo -e "${BOLD}  Commandes utiles :${NC}"
echo -e "    npx prisma studio          # Interface graphique base de données"
echo -e "    npx prisma migrate dev     # Nouvelle migration après modif schema"
echo -e "    npx prisma db seed         # Ré-injecter les données de test"
echo -e "    brew services list         # Statut des services"
echo ""
echo -e "${YELLOW}  Astuce :${NC} Ajoutez \$HOMEBREW_PREFIX/opt/postgresql@15/bin"
echo -e "          et \$HOMEBREW_PREFIX/opt/node@${NODE_REQUIRED}/bin à votre PATH"
echo -e "          dans ~/.zshrc ou ~/.bash_profile si les commandes sont introuvables."
echo ""
