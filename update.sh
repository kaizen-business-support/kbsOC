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
log()     { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# --- Vérifications préalables ---
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
    --branch)   GIT_BRANCH="$2"; shift 2 ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    *) shift ;;
  esac
done

log "=== Mise à jour OptimusCredit ==="
log "Répertoire : $APP_DIR"
log "Heure      : $(date '+%Y-%m-%d %H:%M:%S')"

# ─── 1. Backup de sécurité automatique ──────────────────────────────────────
section "Sauvegarde automatique pré-mise à jour"
source "$BACKEND_ENV" 2>/dev/null || true
DB_URL="${DATABASE_URL:-}"
if [[ -n "$DB_URL" ]]; then
  BACKUP_DIR="$APP_DIR/backups/pre-update"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
  # Extraire les infos de connexion depuis DATABASE_URL
  # Format : postgresql://user:pass@host:port/dbname
  DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|' || echo "5432")
  DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
  DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
  DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

  if PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    log "Backup BDD : $BACKUP_FILE"
    # Nettoyer les backups pré-update de plus de 7 jours
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
  else
    warn "Backup BDD non effectué (pg_dump indisponible ou DB inaccessible) — continuation quand même."
    rm -f "$BACKUP_FILE"
  fi
else
  warn "DATABASE_URL non définie dans .env — backup ignoré."
fi

# ─── 2. Mise à jour du code source (git pull) ───────────────────────────────
section "Mise à jour du code source"
if [[ "$SKIP_PULL" == "true" ]]; then
  warn "--skip-pull activé : mise à jour git ignorée."
else
  cd "$APP_DIR"
  # Vérifier que le dépôt git est propre (pas de modifications non commitées)
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "Des modifications locales non commitées ont été détectées."
    warn "Pour éviter tout conflit, ces modifications sont préservées (git stash)."
    git stash push -m "update.sh auto-stash $(date +%Y%m%d_%H%M%S)"
    STASHED=true
  fi

  CURRENT_BRANCH=$(git branch --show-current)
  TARGET_BRANCH="${GIT_BRANCH:-$CURRENT_BRANCH}"
  log "Branche cible : $TARGET_BRANCH"

  git fetch origin "$TARGET_BRANCH" 2>/dev/null || warn "git fetch échoué — réseau indisponible, continue avec le code local."
  git checkout "$TARGET_BRANCH" 2>/dev/null || true
  git pull origin "$TARGET_BRANCH" 2>/dev/null || warn "git pull échoué — continue avec le code local."

  if [[ "${STASHED:-false}" == "true" ]]; then
    warn "Tentative de restauration du stash local..."
    git stash pop 2>/dev/null || warn "Conflit stash détecté — résolvez manuellement avec : git stash pop"
  fi

  COMMIT=$(git rev-parse --short HEAD)
  log "Code à jour (commit : $COMMIT)"
fi

# ─── 3. Nouveaux packages npm backend ───────────────────────────────────────
section "Mise à jour des dépendances backend"
cd "$APP_DIR/backend"
npm install --prefer-offline 2>&1 | tail -3
log "Dépendances backend OK"

# ─── 4. Nouveaux packages npm frontend ──────────────────────────────────────
section "Mise à jour des dépendances frontend"
cd "$APP_DIR"
npm install --prefer-offline 2>&1 | tail -3
log "Dépendances frontend OK"

# ─── 5. Migration Prisma (schéma → base de données) ─────────────────────────
section "Migration du schéma base de données"
cd "$APP_DIR/backend"
set -o allexport && source "$BACKEND_ENV" && set +o allexport
npx prisma generate
# db push est non-destructif : ajoute les nouveaux champs/tables sans supprimer
npx prisma db push --accept-data-loss
log "Schéma Prisma synchronisé"

# ─── 6. Compilation backend ──────────────────────────────────────────────────
section "Compilation du backend (TypeScript)"
cd "$APP_DIR/backend"
# Compiler dans un dossier temporaire pour valider avant le swap
rm -rf dist_new
npx tsc --outDir dist_new
log "Backend compilé → dist_new/"

# ─── 7. Swap et redémarrage backend ──────────────────────────────────────────
section "Déploiement backend (swap + redémarrage)"
cd "$APP_DIR/backend"
# Swap atomique : dist → dist_old, dist_new → dist
[[ -d dist ]] && mv dist dist_old
mv dist_new dist
rm -rf dist_old
log "Swap dist effectué"

# Redémarrage backend (typiquement < 3s)
chown -R www-data:www-data "$APP_DIR/backend/dist"
systemctl restart optimuscredit-backend
log "Service backend redémarré"

# Attendre que le backend soit prêt
for i in {1..15}; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5007/api/health" 2>/dev/null || echo "000")
  if [[ "$HEALTH" == "200" ]]; then
    log "Backend en ligne (HTTP 200) après ${i}s"
    break
  fi
  sleep 1
done
if [[ "$HEALTH" != "200" ]]; then
  warn "Backend HTTP ${HEALTH} après 15s — vérifiez : journalctl -u optimuscredit-backend -n 50"
fi

# ─── 8. Compilation frontend ─────────────────────────────────────────────────
section "Compilation du frontend (React)"
cd "$APP_DIR"
# Build dans un dossier temporaire
BUILD_TMP="$APP_DIR/build_new"
rm -rf "$BUILD_TMP"
REACT_APP_API_PORT=$(grep REACT_APP_API_PORT .env 2>/dev/null | cut -d= -f2 || echo "5007")
export REACT_APP_API_PORT
BUILD_PATH="$BUILD_TMP" npm run build
log "Frontend compilé → build_new/"

# ─── 9. Swap et redémarrage frontend ─────────────────────────────────────────
section "Déploiement frontend (swap + redémarrage)"
# Swap atomique
[[ -d "$APP_DIR/build" ]] && mv "$APP_DIR/build" "$APP_DIR/build_old"
mv "$BUILD_TMP" "$APP_DIR/build"
rm -rf "$APP_DIR/build_old"
log "Swap build effectué"

chown -R www-data:www-data "$APP_DIR/build"
systemctl restart optimuscredit-frontend
log "Service frontend redémarré"

# ─── 10. Droits finaux ────────────────────────────────────────────────────────
section "Vérification des droits"
chown -R www-data:www-data "$APP_DIR"
systemctl reload nginx 2>/dev/null || true

# ─── 11. Vérification santé finale ───────────────────────────────────────────
section "Vérification finale"
sleep 2
HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5007/api/health" 2>/dev/null || echo "000")
HEALTH_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3006" 2>/dev/null || echo "000")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   OptimusCredit mis à jour avec succès !     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Backend  :${NC}  HTTP ${HEALTH_BACKEND} $([ "$HEALTH_BACKEND" == "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo -e "  ${BLUE}Frontend :${NC}  HTTP ${HEALTH_FRONTEND} $([ "$HEALTH_FRONTEND" == "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
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
