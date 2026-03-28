#!/usr/bin/env bash
# =============================================================================
#  OptimusCredit — Script d'installation
#  Compatible : Ubuntu 22.04 LTS (Jammy) · Ubuntu 24.04 LTS (Noble)
#
#  Usage  : sudo bash install.sh [OPTIONS]
#  Options:
#    --db-password <mdp>   Mot de passe PostgreSQL (auto-généré sinon)
#    --domain      <fqdn>  Domaine nginx   (IP locale par défaut)
#    --skip-seed           Ne pas exécuter le seed initial
#    --no-build            Ne pas compiler  (si build déjà présent)
#
#  Ce script :
#    1. Installe Node.js 20, PostgreSQL 16, Redis 7, nginx
#    2. Configure la base de données et les secrets
#    3. Compile backend (TypeScript) + frontend (React)
#    4. Crée un utilisateur système dédié (optimuscredit)
#    5. Définit les permissions précises sur tous les fichiers
#    6. Enregistre deux services systemd (backend + frontend)
#    7. Configure nginx en reverse proxy
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${CYAN}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; }
die()     { echo -e "${RED}[ERREUR FATALE]${NC} $*" >&2; exit 1; }
section() { echo ""; echo -e "${BLUE}${BOLD}━━━ $* ━━━${NC}"; }

# ─── Constantes application ───────────────────────────────────────────────────
APP_NAME="optimuscredit"
APP_USER="optimuscredit"          # utilisateur système dédié (créé par ce script)
APP_GROUP="optimuscredit"
DB_NAME="optimus_credit"
DB_USER="optimus"
BACKEND_PORT=5007
FRONTEND_PORT=3006
NODE_MAJOR=20
PG_MAJOR=16

# ─── Parsing des arguments ────────────────────────────────────────────────────
OPT_DB_PASS=""
OPT_DOMAIN=""
OPT_SKIP_SEED=false
OPT_NO_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-password) OPT_DB_PASS="$2"; shift 2 ;;
    --domain)      OPT_DOMAIN="$2";  shift 2 ;;
    --skip-seed)   OPT_SKIP_SEED=true; shift ;;
    --no-build)    OPT_NO_BUILD=true;  shift ;;
    *) warn "Argument inconnu ignoré : $1"; shift ;;
  esac
done

# ─── Vérification root ────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Lancez ce script en root : sudo bash install.sh"

# ─── Répertoire de l'application ──────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$APP_DIR/.env"

[[ -d "$BACKEND_DIR" && -f "$APP_DIR/package.json" ]] \
  || die "Répertoire invalide : $APP_DIR (backend/ ou package.json manquant)"

MACHINE_IP=$(hostname -I | awk '{print $1}')
DOMAIN="${OPT_DOMAIN:-$MACHINE_IP}"

# ─── Bannière ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║         OptimusCredit — Installateur v3.1                ║"
echo "  ║    Ubuntu 22.04 / 24.04 · Node 20 · PG 16 · Redis 7     ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Répertoire : ${CYAN}$APP_DIR${NC}"
echo -e "  Utilisateur service : ${CYAN}$APP_USER${NC}"
echo -e "  IP Machine  : ${CYAN}$MACHINE_IP${NC}"
echo -e "  Domaine     : ${CYAN}$DOMAIN${NC}"
echo ""

# =============================================================================
# 1. PRÉ-FLIGHT CHECKS
# =============================================================================
section "Pré-flight checks"

PREFLIGHT_OK=true

# Détection OS et version Ubuntu
source /etc/os-release 2>/dev/null || true
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo -e "  ${RED}[✗]${NC} OS non supporté : ${PRETTY_NAME:-inconnu} (Ubuntu requis)"
  PREFLIGHT_OK=false
else
  UBUNTU_VER="${VERSION_ID:-0}"
  UBUNTU_CODENAME="${VERSION_CODENAME:-unknown}"
  UBUNTU_MAJOR=$(echo "$UBUNTU_VER" | cut -d. -f1)

  if [[ "$UBUNTU_MAJOR" -eq 24 ]]; then
    log "Ubuntu 24.04 LTS (Noble) détecté ✔"
    IS_NOBLE=true
  elif [[ "$UBUNTU_MAJOR" -eq 22 ]]; then
    log "Ubuntu 22.04 LTS (Jammy) détecté ✔"
    IS_NOBLE=false
  elif [[ "$UBUNTU_MAJOR" -ge 22 ]]; then
    warn "Ubuntu $UBUNTU_VER — non testé mais compatible (>= 22.04)"
    IS_NOBLE=false
  else
    echo -e "  ${RED}[✗]${NC} Ubuntu 22.04+ requis — version : $UBUNTU_VER"
    PREFLIGHT_OK=false
    IS_NOBLE=false
  fi
fi

# Disque >= 4 Go
DISK_FREE_GB=$(( $(df / --output=avail 2>/dev/null | tail -1 | tr -d ' ') / 1024 / 1024 ))
if [[ $DISK_FREE_GB -ge 4 ]]; then
  log "Espace disque : ${DISK_FREE_GB} Go disponibles"
else
  echo -e "  ${RED}[✗]${NC} Espace insuffisant : ${DISK_FREE_GB} Go (minimum 4 Go)"
  PREFLIGHT_OK=false
fi

# RAM
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [[ $RAM_MB -ge 1024 ]]; then
  log "RAM : ${RAM_MB} Mo"
elif [[ $RAM_MB -ge 512 ]]; then
  warn "RAM faible : ${RAM_MB} Mo (1 Go recommandé)"
else
  echo -e "  ${RED}[✗]${NC} RAM insuffisante : ${RAM_MB} Mo (minimum 512 Mo)"
  PREFLIGHT_OK=false
fi

# Internet
if curl -s --connect-timeout 6 https://registry.npmjs.org/ -o /dev/null; then
  log "Connectivité internet : OK"
else
  echo -e "  ${RED}[✗]${NC} Pas de connexion internet"
  PREFLIGHT_OK=false
fi

# Ports
for port in 80 "$BACKEND_PORT" "$FRONTEND_PORT" 5432 6379; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    warn "Port $port déjà utilisé (sera réutilisé)"
  else
    log "Port $port : libre"
  fi
done

[[ "$PREFLIGHT_OK" == "true" ]] \
  || die "Pré-requis non satisfaits. Corrigez les erreurs ci-dessus."

# =============================================================================
# 2. SECRETS
# =============================================================================
DB_PASS="${OPT_DB_PASS:-}"

if [[ -z "$DB_PASS" && -f "$BACKEND_ENV" ]]; then
  _existing=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" \
    | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|' || true)
  [[ -n "$_existing" ]] && DB_PASS="$_existing" \
    && warn "Mot de passe DB récupéré depuis backend/.env existant"
fi
[[ -z "$DB_PASS" ]] && DB_PASS=$(openssl rand -base64 24 | tr -d '+/=')

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# =============================================================================
# 3. DÉPENDANCES SYSTÈME
# =============================================================================
section "Dépendances système"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Paquets communs 22.04 + 24.04
BASE_PKGS=(curl wget git build-essential openssl ca-certificates gnupg
           lsb-release python3 python3-pip software-properties-common
           apt-transport-https unzip jq acl)

# Ubuntu 24.04 : python3-full requis pour pip hors venv
if [[ "$IS_NOBLE" == "true" ]]; then
  BASE_PKGS+=(python3-full)
fi

MISSING=()
for pkg in "${BASE_PKGS[@]}"; do
  dpkg -s "$pkg" &>/dev/null || MISSING+=("$pkg")
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  info "Installation : ${MISSING[*]}"
  apt-get install -y "${MISSING[@]}"
fi
log "Dépendances système : OK"

# =============================================================================
# 4. UTILISATEUR SYSTÈME DÉDIÉ
# =============================================================================
section "Utilisateur système '$APP_USER'"

if id "$APP_USER" &>/dev/null; then
  log "Utilisateur '$APP_USER' existe déjà"
else
  useradd --system --shell /bin/bash \
          --home-dir "$APP_DIR" \
          --no-create-home \
          --comment "OptimusCredit Service" \
          "$APP_USER"
  log "Utilisateur système '$APP_USER' créé"
fi

# Ajouter au groupe www-data pour lecture des fichiers nginx si besoin
usermod -aG www-data "$APP_USER" 2>/dev/null || true

# =============================================================================
# 5. NODE.JS 20 LTS
# =============================================================================
section "Node.js $NODE_MAJOR LTS"

CURRENT_NODE=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")

if [[ "$CURRENT_NODE" -ge "$NODE_MAJOR" ]]; then
  log "Node.js $(node -v) — npm $(npm -v) : déjà installé"
else
  [[ "$CURRENT_NODE" -gt 0 ]] \
    && warn "Node.js $(node -v) trop ancien — mise à jour vers v${NODE_MAJOR}" \
    || info "Installation de Node.js ${NODE_MAJOR}..."

  # Même URL NodeSource pour 22.04 et 24.04
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" \
    | bash - 2>&1 | grep -E '(##|ERROR)' || true

  apt-get install -y nodejs
  log "Node.js $(node -v) — npm $(npm -v) installé"
fi

# =============================================================================
# 6. POSTGRESQL 16
# =============================================================================
section "PostgreSQL $PG_MAJOR"

PG_INSTALLED=$(psql --version 2>/dev/null | awk '{print $3}' | cut -d. -f1 || echo "0")

if [[ "$PG_INSTALLED" -ge "$PG_MAJOR" ]]; then
  log "PostgreSQL $(psql --version | awk '{print $3}') déjà installé"
else
  [[ "$PG_INSTALLED" -gt 0 ]] \
    && warn "PostgreSQL $PG_INSTALLED détecté — installation de $PG_MAJOR" \
    || info "Installation de PostgreSQL $PG_MAJOR (dépôt pgdg)..."

  # Même dépôt pgdg pour jammy et noble
  install -d /usr/share/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg

  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
https://apt.postgresql.org/pub/repos/apt ${UBUNTU_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list

  apt-get update -qq
  apt-get install -y "postgresql-${PG_MAJOR}" "postgresql-client-${PG_MAJOR}"
  log "PostgreSQL $(psql --version | awk '{print $3}') installé"
fi

command -v pg_dump &>/dev/null \
  || apt-get install -y "postgresql-client-${PG_MAJOR}" 2>/dev/null \
  || apt-get install -y postgresql-client

systemctl enable --now postgresql
log "Service postgresql : actif"

# =============================================================================
# 7. REDIS 7
# =============================================================================
section "Redis 7"

REDIS_MAJOR=$(redis-server --version 2>/dev/null \
  | awk '{print $3}' | tr -d 'v=' | cut -d. -f1 || echo "0")

if [[ "$REDIS_MAJOR" -ge 7 ]]; then
  log "Redis $(redis-server --version | awk '{print $3}' | tr -d 'v=') déjà installé"
else
  info "Installation de Redis 7..."

  if [[ "$IS_NOBLE" == "true" ]]; then
    # Ubuntu 24.04 : Redis 7 disponible dans les dépôts officiels
    apt-get install -y redis-server
  else
    # Ubuntu 22.04 : dépôt officiel Redis pour garantir la v7
    curl -fsSL https://packages.redis.io/gpg \
      | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
https://packages.redis.io/deb $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/redis.list
    apt-get update -qq
    apt-get install -y redis
  fi

  log "Redis installé"
fi

sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf 2>/dev/null || true
systemctl enable --now redis-server
log "Service redis-server : actif (127.0.0.1 uniquement)"

# =============================================================================
# 8. NGINX
# =============================================================================
section "nginx"

command -v nginx &>/dev/null \
  && log "nginx $(nginx -v 2>&1 | grep -oP '[\d.]+') déjà installé" \
  || { apt-get install -y nginx && log "nginx installé"; }

systemctl enable nginx
log "Service nginx : activé"

# =============================================================================
# 9. CONFIGURATION POSTGRESQL
# =============================================================================
section "Configuration base de données"

# PG 16 / Ubuntu 24.04 utilise scram-sha-256 par défaut — on garde
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'scram-sha-256';" 2>/dev/null || true
sudo -u postgres psql -c "SELECT pg_reload_conf();" 2>/dev/null || true

# Utilisateur DB
if sudo -u postgres psql -tc \
    "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 2>/dev/null; then
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  log "Utilisateur DB '${DB_USER}' : mot de passe mis à jour"
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  log "Utilisateur DB '${DB_USER}' créé"
fi

# Base de données
if ! sudo -u postgres psql -tc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 2>/dev/null; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  log "Base '${DB_NAME}' créée"
else
  log "Base '${DB_NAME}' : déjà présente"
fi

# Privilèges complets (y compris après futures migrations)
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" \
  -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" \
  -c "GRANT ALL ON ALL TABLES    IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};"
log "Privilèges DB accordés"

# pg_hba.conf — trust localhost pour Prisma (pas d'authentification en local)
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
[[ -z "$PG_HBA" || ! -f "$PG_HBA" ]] && die "pg_hba.conf introuvable"

cp "$PG_HBA" "${PG_HBA}.bak.$(date +%Y%m%d_%H%M%S)"

python3 - <<PYEOF
import re
hba  = "$PG_HBA"
db   = "$DB_NAME"
user = "$DB_USER"
with open(hba) as f:
    lines = f.readlines()
# Supprimer les anciennes règles OptimusCredit
lines = [l for l in lines if "OptimusCredit" not in l]
lines = [l for l in lines if not (db in l and user in l)]
rules = [
    "# OptimusCredit — connexions locales uniquement (trust = sans mot de passe)\n",
    f"host   {db}   {user}   127.0.0.1/32   trust\n",
    f"host   {db}   {user}   ::1/128        trust\n",
    f"local  {db}   {user}                  trust\n",
]
idx = next((i for i, l in enumerate(lines) if re.match(r'^host\b', l)), len(lines))
lines[idx:idx] = rules
with open(hba, 'w') as f:
    f.writelines(lines)
print(f"  pg_hba.conf : règles trust injectées ligne {idx+1}")
PYEOF

systemctl restart postgresql
sleep 2
log "PostgreSQL redémarré (nouvelles règles hba)"

# Test connexion
info "Test connexion base..."
for i in {1..5}; do
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p 5432 -U "$DB_USER" \
    -d "$DB_NAME" -c "SELECT 1" &>/dev/null && break
  [[ $i -eq 5 ]] \
    && die "Connexion impossible après 5 tentatives.\n  journalctl -u postgresql -n 30"
  sleep 2
done
log "Connexion base de données : OK"

# =============================================================================
# 10. FICHIERS .ENV
# =============================================================================
section "Configuration .env"

# ── Backend ──────────────────────────────────────────────────────────────────
if [[ ! -f "$BACKEND_ENV" ]]; then
  info "Génération backend/.env..."
  cat > "$BACKEND_ENV" <<EOF
# ── OptimusCredit Backend — généré le $(date '+%Y-%m-%d %H:%M') ──

NODE_ENV=production
PORT=${BACKEND_PORT}

# Base de données
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRY=8h
JWT_REFRESH_EXPIRY=7d

# Redis
REDIS_URL=redis://127.0.0.1:6379

# URLs
FRONTEND_URL=http://${DOMAIN}
FRONTEND_PORT=${FRONTEND_PORT}
API_BASE_URL=http://${DOMAIN}/api

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,png,jpg,jpeg,xlsx,xls,doc,docx

# Email (configurer après installation)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=OptimusCredit <noreply@${DOMAIN}>

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
AUDIT_RETENTION_DAYS=60

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS
ALLOWED_ORIGINS=http://${DOMAIN},http://${MACHINE_IP}
EOF
  log "backend/.env généré"
else
  warn "backend/.env existe — conservé"
  grep -qE 'DATABASE_URL=.*@localhost' "$BACKEND_ENV" \
    && sed -i 's|@localhost:|@127.0.0.1:|g' "$BACKEND_ENV" \
    && log "DATABASE_URL : localhost → 127.0.0.1"
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [[ ! -f "$FRONTEND_ENV" ]]; then
  cat > "$FRONTEND_ENV" <<EOF
REACT_APP_API_PORT=${BACKEND_PORT}
HOST=0.0.0.0
PORT=${FRONTEND_PORT}
GENERATE_SOURCEMAP=false
EOF
  log ".env frontend généré"
else
  warn ".env frontend existe — conservé"
fi

# =============================================================================
# 11. DÉPENDANCES NPM  (exécuté en root — les fichiers seront ré-ownerés après)
# =============================================================================
section "Dépendances npm"

info "Backend..."
cd "$BACKEND_DIR"
npm install --legacy-peer-deps
log "npm install backend : OK"

info "Frontend..."
cd "$APP_DIR"
npm install --legacy-peer-deps
log "npm install frontend : OK"

# serve — pour distribuer le build React en production
if ! command -v serve &>/dev/null; then
  info "Installation globale de serve..."
  npm install -g serve
fi
SERVE_BIN="$(command -v serve)"
log "serve : $SERVE_BIN ($(serve --version 2>/dev/null || echo 'OK'))"

# =============================================================================
# 12. PRISMA — MIGRATIONS & SEED
# =============================================================================
section "Prisma — migrations"

cd "$BACKEND_DIR"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

info "Génération du client Prisma..."
npx prisma generate
log "Client Prisma généré"

info "Application des migrations..."
if npx prisma migrate deploy 2>/dev/null; then
  log "Migrations Prisma appliquées (migrate deploy)"
else
  warn "migrate deploy non disponible — db push en fallback..."
  npx prisma db push --accept-data-loss
  log "Schéma Prisma appliqué (db push)"
fi

# Re-grant systématique après création des tables par Prisma
sudo -u postgres psql -d "$DB_NAME" \
  -c "GRANT ALL ON ALL TABLES    IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>/dev/null || true
log "Privilèges post-migration : OK"

# Seed
if [[ "$OPT_SKIP_SEED" == "false" ]]; then
  info "Chargement des données de démonstration..."
  if npm run seed 2>&1 | tail -5; then
    log "Seed effectué (comptes démo disponibles — mot de passe : demo123)"
  else
    warn "Seed ignoré (données déjà présentes ou erreur non bloquante)"
  fi
fi

# =============================================================================
# 13. COMPILATION
# =============================================================================
if [[ "$OPT_NO_BUILD" == "false" ]]; then
  section "Compilation"

  info "Backend TypeScript → dist/..."
  cd "$BACKEND_DIR"
  npm run build
  log "Backend compilé"

  info "Frontend React → build/..."
  cd "$APP_DIR"
  CI=false npm run build        # CI=false : warnings non bloquants
  log "Frontend compilé"
else
  warn "--no-build spécifié : compilation ignorée"
fi

# =============================================================================
# 14. PERMISSIONS — SECTION CRITIQUE
# =============================================================================
section "Permissions (résolution des problèmes d'accès)"

# ── 14.1 Créer tous les répertoires d'exécution ──────────────────────────────
RUNTIME_DIRS=(
  "$BACKEND_DIR/logs"
  "$BACKEND_DIR/uploads"
  "$BACKEND_DIR/backups"
  "$BACKEND_DIR/uploads/documents"
  "$BACKEND_DIR/uploads/temp"
)
for d in "${RUNTIME_DIRS[@]}"; do
  mkdir -p "$d"
  log "Répertoire créé : $d"
done

# ── 14.2 Propriété globale → APP_USER ────────────────────────────────────────
info "Attribution propriété $APP_USER:$APP_GROUP sur $APP_DIR..."
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
log "Propriété : $APP_USER:$APP_GROUP"

# ── 14.3 Permissions fichiers/répertoires (principe du moindre privilège) ─────
#
#  Stratégie :
#    • Répertoires app     : 755  (rwxr-xr-x) — lisibles par tous, modifiables par APP_USER
#    • Fichiers source     : 644  (rw-r--r--)  — lisibles par tous, modifiables par APP_USER
#    • Fichiers .env       : 640  (rw-r-----)  — lecture seule par le groupe
#    • Répertoires runtime : 775  (rwxrwxr-x) — écriture groupe + setgid
#    • Exécutables         : 755  (rwxr-xr-x)
#    • Logs/uploads/backup : 770  (rwxrwx---) — APP_USER + groupe seulement
#
info "Permissions répertoires..."
# Répertoires principaux
find "$APP_DIR" -type d \
  -not -path "$BACKEND_DIR/node_modules/*" \
  -not -path "$APP_DIR/node_modules/*" \
  -exec chmod 755 {} \;

# Fichiers sources
find "$APP_DIR" -type f \
  -not -path "$BACKEND_DIR/node_modules/*" \
  -not -path "$APP_DIR/node_modules/*" \
  -exec chmod 644 {} \;

# Scripts shell → exécutables
find "$APP_DIR" -maxdepth 1 -name "*.sh" -exec chmod 755 {} \;
find "$APP_DIR/deploy" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true

log "Permissions de base : OK"

# ── Fichiers .env — lecture seule APP_USER + groupe ──────────────────────────
chmod 640 "$BACKEND_ENV" 2>/dev/null || true
chmod 640 "$FRONTEND_ENV" 2>/dev/null || true
log ".env : mode 640 (lecture APP_USER + groupe uniquement)"

# ── node_modules — lisibles mais non modifiables en runtime ──────────────────
# (ils sont écrits à l'install, pas en runtime)
chmod -R o+rX "$BACKEND_DIR/node_modules" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/node_modules"     2>/dev/null || true
log "node_modules : lisibles"

# ── dist/ et build/ — lisibles ───────────────────────────────────────────────
[[ -d "$BACKEND_DIR/dist" ]] && chmod -R 755 "$BACKEND_DIR/dist"
[[ -d "$APP_DIR/build"    ]] && chmod -R 755 "$APP_DIR/build"
log "dist/ build/ : mode 755"

# ── Répertoires runtime — écriture APP_USER + groupe ─────────────────────────
for d in "${RUNTIME_DIRS[@]}"; do
  chmod 770 "$d"
  # setgid : les nouveaux fichiers héritent du groupe
  chmod g+s "$d"
done
log "Répertoires runtime (logs/uploads/backups) : mode 770 + setgid"

# ── prisma/migrations — APP_USER doit pouvoir écrire (migrate dev) ───────────
[[ -d "$BACKEND_DIR/prisma" ]] && chmod -R 755 "$BACKEND_DIR/prisma"
log "prisma/ : mode 755"

# ── ACL — droits additionnels pour nginx (lecture build/) ────────────────────
if command -v setfacl &>/dev/null; then
  setfacl -R -m u:www-data:rX "$APP_DIR/build"   2>/dev/null || true
  setfacl -R -m u:www-data:rX "$BACKEND_DIR/dist" 2>/dev/null || true
  log "ACL nginx (www-data) : lecture build/ et dist/"
fi

# ── Résumé des permissions ────────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Récapitulatif des permissions :${NC}"
echo -e "  Propriétaire  : ${APP_USER}:${APP_GROUP}"
echo -e "  Sources       : 644 (fichiers) · 755 (répertoires)"
echo -e "  .env          : 640 (APP_USER + groupe)"
echo -e "  logs/uploads/ : 770 + setgid (écriture APP_USER uniquement)"
echo -e "  dist/build/   : 755 (lecture tous)"
echo ""

# =============================================================================
# 15. SERVICES SYSTEMD
# =============================================================================
section "Services systemd"

# ── Backend ───────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/${APP_NAME}-backend.service <<EOF
[Unit]
Description=OptimusCredit — API Backend (Node.js)
Documentation=https://github.com/kaizen-business-support/kbsOC
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
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

# ── Permissions runtime ──────────────────────────────────────────────────────
# UMask : fichiers créés en 660 (APP_USER:APP_GROUP) par défaut
UMask=007

# Répertoires accessibles en écriture par le service
ReadWritePaths=${BACKEND_DIR}/logs
ReadWritePaths=${BACKEND_DIR}/uploads
ReadWritePaths=${BACKEND_DIR}/backups
ReadWritePaths=${BACKEND_DIR}/prisma

# Isolation légère (sans ProtectSystem=strict qui bloque trop)
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
log "Service ${APP_NAME}-backend créé"

# ── Frontend ──────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/${APP_NAME}-frontend.service <<EOF
[Unit]
Description=OptimusCredit — Frontend React (serve)
Documentation=https://github.com/kaizen-business-support/kbsOC
After=network.target ${APP_NAME}-backend.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
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
log "Service ${APP_NAME}-frontend créé"

# =============================================================================
# 16. NGINX — REVERSE PROXY
# =============================================================================
section "nginx — reverse proxy"

cat > /etc/nginx/sites-available/${APP_NAME} <<NGINXEOF
# OptimusCredit — nginx ($(date '+%Y-%m-%d'))
server {
    listen 80;
    server_name ${DOMAIN} _;

    client_max_body_size 50M;
    client_body_timeout  120s;
    server_tokens off;

    # En-têtes de sécurité
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
log "nginx configuré"

# =============================================================================
# 17. UFW
# =============================================================================
section "Pare-feu UFW"

if command -v ufw &>/dev/null; then
  ufw allow OpenSSH      2>/dev/null | grep -v '^$' | head -1 || true
  ufw allow 'Nginx HTTP' 2>/dev/null | grep -v '^$' | head -1 || true
  # Ports internes (5007, 3006, 5432, 6379) fermés au WAN
  ufw --force enable 2>/dev/null | head -1 || true
  log "UFW : SSH + HTTP ouverts — ports internes protégés"
else
  warn "UFW absent — pare-feu non configuré"
fi

# =============================================================================
# 18. DÉMARRAGE DES SERVICES
# =============================================================================
section "Démarrage des services"

systemctl daemon-reload

for svc in ${APP_NAME}-backend ${APP_NAME}-frontend; do
  systemctl enable  "$svc"
  systemctl restart "$svc"
  sleep 4
  if systemctl is-active --quiet "$svc"; then
    log "$svc : ✔ actif"
  else
    warn "$svc : pas encore actif"
    warn "  → journalctl -u $svc -n 50 --no-pager"
  fi
done

systemctl reload nginx && log "nginx rechargé"

# =============================================================================
# 19. VÉRIFICATION SANTÉ FINALE
# =============================================================================
section "Vérification santé"
sleep 6

_check() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    log "$label : HTTP $code ✔"
  else
    warn "$label : HTTP $code (peut nécessiter quelques secondes de plus)"
  fi
}

_check "API /api/health (direct)"  "http://127.0.0.1:${BACKEND_PORT}/api/health"
_check "Frontend (direct)"         "http://127.0.0.1:${FRONTEND_PORT}"
_check "nginx :80 → API"           "http://127.0.0.1/api/health"
_check "nginx :80 → Frontend"      "http://127.0.0.1/"

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║          OptimusCredit installé avec succès !            ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Application${NC}  :  ${CYAN}http://${DOMAIN}${NC}"
echo -e "  ${BOLD}API${NC}          :  ${CYAN}http://${DOMAIN}/api${NC}"
echo -e "  ${BOLD}Health${NC}       :  ${CYAN}http://${DOMAIN}/api/health${NC}"
echo ""
echo -e "  ${YELLOW}${BOLD}Comptes démo — mot de passe : demo123${NC}"
echo "  ┌────────────────────────────────────┬──────────────────────────┐"
echo "  │ admin@bank.sn                      │ Administrateur           │"
echo "  │ resp.analyste@bank.sn              │ Responsable Analyste     │"
echo "  │ fatou.ndiaye@bank.sn               │ Analyste Crédit          │"
echo "  │ amadou.diop@bank.sn                │ Chargé d'Affaires        │"
echo "  │ moussa.sarr@bank.sn                │ Directeur d'Agence       │"
echo "  │ comite@bank.sn                     │ Comité de Crédit         │"
echo "  │ direction@bank.sn                  │ Direction Générale       │"
echo "  └────────────────────────────────────┴──────────────────────────┘"
echo ""
echo -e "  ${YELLOW}${BOLD}Gestion des services${NC}"
echo "    systemctl status  ${APP_NAME}-backend"
echo "    systemctl status  ${APP_NAME}-frontend"
echo "    systemctl restart ${APP_NAME}-backend"
echo "    journalctl -u     ${APP_NAME}-backend  -f"
echo "    journalctl -u     ${APP_NAME}-frontend -f"
echo ""
echo -e "  ${YELLOW}${BOLD}Diagnostic permissions${NC}"
echo "    ls -la ${APP_DIR}"
echo "    ls -la ${BACKEND_DIR}/logs"
echo "    ls -la ${BACKEND_DIR}/uploads"
echo "    sudo -u ${APP_USER} cat ${BACKEND_ENV}"
echo ""
echo -e "  ${YELLOW}${BOLD}Mise à jour${NC}"
echo "    git pull && sudo bash install.sh --skip-seed"
echo ""
echo -e "  ${RED}${BOLD}IMPORTANT — Sauvegardez ces informations :${NC}"
echo "    Utilisateur service : ${APP_USER}"
echo "    DB_USER = ${DB_USER}"
echo "    DB_NAME = ${DB_NAME}"
echo "    DB_PASS = ${DB_PASS}"
echo "    Fichier : ${BACKEND_ENV}"
echo ""
