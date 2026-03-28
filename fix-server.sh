#!/usr/bin/env bash
# =============================================================================
#  OptimusCredit — Script de réparation / diagnostic 502
#  Usage : sudo bash fix-server.sh
#  Ce script corrige les problèmes courants sans réinstaller.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $*"; }
info()    { echo -e "${CYAN}[→]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo ""; echo -e "${BLUE}${BOLD}━━━ $* ━━━${NC}"; }

[[ $EUID -eq 0 ]] || die "Lancez en root : sudo bash fix-server.sh"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
APP_USER="optimuscredit"
APP_NAME="optimuscredit"
BACKEND_PORT=5007
FRONTEND_PORT=3006

echo ""
echo -e "${BLUE}${BOLD}  OptimusCredit — Diagnostic & Réparation 502${NC}"
echo ""

# =============================================================================
# 1. ÉTAT DES SERVICES
# =============================================================================
section "État des services"

for svc in ${APP_NAME}-backend ${APP_NAME}-frontend; do
  if systemctl is-active --quiet "$svc"; then
    log "$svc : ✔ actif"
  else
    warn "$svc : ✗ INACTIF"
    echo -e "  ${YELLOW}Dernières lignes de log :${NC}"
    journalctl -u "$svc" -n 15 --no-pager 2>/dev/null | sed 's/^/    /'
    echo ""
  fi
done

# =============================================================================
# 2. VÉRIFICATION ET CORRECTION DU .ENV
# =============================================================================
section "Vérification backend/.env"

if [[ ! -f "$BACKEND_ENV" ]]; then
  die "backend/.env absent — relancez install.sh"
fi

# Lire la DATABASE_URL actuelle
RAW_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" \
  | cut -d= -f2- | tr -d '"'"'" | tr -d ' ')

echo -e "  DATABASE_URL : ${CYAN}${RAW_URL//:*@/:*****@}${NC}"

# Valider que l'URL est au bon format
if [[ "$RAW_URL" != postgresql://* ]]; then
  warn "DATABASE_URL invalide ! Correction en cours..."

  # Extraire les composants depuis le fichier de config systemd ou auto-générer
  DB_NAME="optimus_credit"
  DB_USER="optimus"

  # Récupérer le mot de passe depuis PostgreSQL (on le regénère si nécessaire)
  NEW_PASS=$(openssl rand -base64 24 | tr -d '+/=')

  # Mettre à jour le mot de passe dans PostgreSQL
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${NEW_PASS}';" 2>/dev/null \
    || { sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${NEW_PASS}';" && \
         sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"; }

  # Corriger la DATABASE_URL dans le .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${NEW_PASS}@127.0.0.1:5432/${DB_NAME}|" "$BACKEND_ENV"
  log "DATABASE_URL corrigée"
  warn "NOUVEAU MOT DE PASSE DB : $NEW_PASS — sauvegardez-le !"
else
  log "DATABASE_URL : format valide"

  # Vérifier que l'hôte est bien 127.0.0.1 (pas localhost qui peut poser problème)
  if echo "$RAW_URL" | grep -q '@localhost:'; then
    sed -i 's|@localhost:|@127.0.0.1:|g' "$BACKEND_ENV"
    log "localhost → 127.0.0.1 corrigé"
  fi
fi

# =============================================================================
# 3. VÉRIFICATION TEST CONNEXION DB
# =============================================================================
section "Test connexion base de données"

RAW_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" \
  | cut -d= -f2- | tr -d '"'"'" | tr -d ' ')

DB_HOST=$(echo "$RAW_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$RAW_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME_TEST=$(echo "$RAW_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER_TEST=$(echo "$RAW_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS_TEST=$(echo "$RAW_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

if PGPASSWORD="$DB_PASS_TEST" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" \
    -U "$DB_USER_TEST" -d "$DB_NAME_TEST" -c "SELECT 1" &>/dev/null; then
  log "Connexion PostgreSQL : OK"
else
  warn "Connexion PostgreSQL échoue — vérification des règles pg_hba..."

  PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
  if [[ -f "$PG_HBA" ]]; then
    # Injecter les règles trust si absentes
    if ! grep -q "$DB_NAME_TEST" "$PG_HBA" 2>/dev/null; then
      cp "$PG_HBA" "${PG_HBA}.bak.$(date +%Y%m%d_%H%M%S)"
      python3 - <<PYEOF
import re
hba  = "$PG_HBA"
db   = "$DB_NAME_TEST"
user = "$DB_USER_TEST"
with open(hba) as f:
    lines = f.readlines()
rules = [
    "# OptimusCredit\n",
    f"host   {db}   {user}   127.0.0.1/32   trust\n",
    f"host   {db}   {user}   ::1/128        trust\n",
    f"local  {db}   {user}                  trust\n",
]
idx = next((i for i, l in enumerate(lines) if re.match(r'^host\b', l)), len(lines))
lines[idx:idx] = rules
with open(hba, 'w') as f:
    f.writelines(lines)
PYEOF
      systemctl restart postgresql
      sleep 2
      log "Règles pg_hba injectées — PostgreSQL redémarré"
    fi
  fi
fi

# =============================================================================
# 4. VÉRIFICATION DES FICHIERS COMPILÉS
# =============================================================================
section "Fichiers compilés"

NEED_BUILD=false

if [[ ! -f "$BACKEND_DIR/dist/server.js" ]]; then
  warn "dist/server.js absent — recompilation nécessaire"
  NEED_BUILD=true
else
  log "dist/server.js : présent"
fi

if [[ ! -d "$APP_DIR/build" || -z "$(ls -A "$APP_DIR/build" 2>/dev/null)" ]]; then
  warn "build/ absent ou vide — recompilation nécessaire"
  NEED_BUILD=true
else
  log "build/ : présent"
fi

if [[ "$NEED_BUILD" == "true" ]]; then
  section "Recompilation"

  export DATABASE_URL="$RAW_URL"

  if [[ ! -f "$BACKEND_DIR/dist/server.js" ]]; then
    info "Compilation backend..."
    cd "$BACKEND_DIR"
    npx prisma generate
    npm run build
    log "Backend compilé"
  fi

  if [[ ! -d "$APP_DIR/build" || -z "$(ls -A "$APP_DIR/build" 2>/dev/null)" ]]; then
    info "Compilation frontend..."
    cd "$APP_DIR"
    CI=false npm run build
    log "Frontend compilé"
  fi
fi

# =============================================================================
# 5. CORRECTION DES PERMISSIONS
# =============================================================================
section "Permissions"

# S'assurer que l'utilisateur existe
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/bash \
          --home-dir "$APP_DIR" --no-create-home \
          --comment "OptimusCredit Service" "$APP_USER"
  log "Utilisateur '$APP_USER' créé"
fi

info "Réattribution propriété → $APP_USER..."
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Répertoires runtime avec écriture
for d in "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$BACKEND_DIR/backups" \
          "$BACKEND_DIR/uploads/documents" "$BACKEND_DIR/uploads/temp"; do
  mkdir -p "$d"
  chown "$APP_USER:$APP_USER" "$d"
  chmod 770 "$d"
  chmod g+s "$d"
done

# dist/ et build/ lisibles
[[ -d "$BACKEND_DIR/dist" ]] && chmod -R 755 "$BACKEND_DIR/dist"
[[ -d "$APP_DIR/build"    ]] && chmod -R 755 "$APP_DIR/build"

# .env lisible par le service
chmod 640 "$BACKEND_ENV" 2>/dev/null || true

# node_modules lisibles
chmod -R o+rX "$BACKEND_DIR/node_modules" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/node_modules"     2>/dev/null || true

# Scripts exécutables
chmod 755 "$APP_DIR"/*.sh 2>/dev/null || true

log "Permissions corrigées"

# =============================================================================
# 6. VÉRIFICATION SERVICE SERVE
# =============================================================================
section "Vérification serve"

SERVE_BIN="$(command -v serve 2>/dev/null || true)"
if [[ -z "$SERVE_BIN" ]]; then
  warn "serve absent — installation..."
  npm install -g serve
  SERVE_BIN="$(command -v serve)"
  log "serve installé : $SERVE_BIN"
else
  log "serve : $SERVE_BIN"
fi

# Mettre à jour ExecStart si serve a changé de chemin
if [[ -f /etc/systemd/system/${APP_NAME}-frontend.service ]]; then
  CURRENT_SERVE=$(grep ExecStart /etc/systemd/system/${APP_NAME}-frontend.service \
    | awk '{print $1}' | cut -d= -f2)
  if [[ "$CURRENT_SERVE" != "$SERVE_BIN" ]]; then
    sed -i "s|ExecStart=.*serve |ExecStart=${SERVE_BIN} |" \
      /etc/systemd/system/${APP_NAME}-frontend.service
    log "Chemin serve mis à jour dans le service"
  fi
fi

# =============================================================================
# 7. REDÉMARRAGE DES SERVICES
# =============================================================================
section "Redémarrage des services"

systemctl daemon-reload

for svc in ${APP_NAME}-backend ${APP_NAME}-frontend; do
  info "Redémarrage de $svc..."
  systemctl restart "$svc" || true
  sleep 4
  if systemctl is-active --quiet "$svc"; then
    log "$svc : ✔ actif"
  else
    warn "$svc : toujours inactif"
    journalctl -u "$svc" -n 20 --no-pager | tail -20 | sed 's/^/    /'
  fi
done

systemctl reload nginx 2>/dev/null && log "nginx rechargé" || true

# =============================================================================
# 8. TEST FINAL
# =============================================================================
section "Test final"
sleep 4

_check() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    log "$label : HTTP $code ✔"
  else
    warn "$label : HTTP $code"
  fi
}

MACHINE_IP=$(hostname -I | awk '{print $1}')
_check "API health  (direct)"  "http://127.0.0.1:${BACKEND_PORT}/api/health"
_check "Frontend    (direct)"  "http://127.0.0.1:${FRONTEND_PORT}"
_check "nginx :80 → API"       "http://127.0.0.1/api/health"
_check "nginx :80 → Frontend"  "http://127.0.0.1/"

echo ""
echo -e "  ${BOLD}Application : ${CYAN}http://${MACHINE_IP}${NC}"
echo ""
echo -e "  ${YELLOW}Si le 502 persiste, affichez les logs complets :${NC}"
echo "    sudo journalctl -u ${APP_NAME}-backend  -n 80 --no-pager"
echo "    sudo journalctl -u ${APP_NAME}-frontend -n 40 --no-pager"
echo "    sudo cat $BACKEND_ENV"
echo ""
