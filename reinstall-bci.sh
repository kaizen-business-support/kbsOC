#!/usr/bin/env bash
# =============================================================================
#  BCI — Script de RÉINSTALLATION COMPLÈTE (Ubuntu 22.04)
#  Usage : sudo bash reinstall-bci.sh [--force] [--branch <nom>]
#
#  ⚠️  DESTRUCTIF — Repart complètement de zéro :
#    1.  Backup DB (dump custom + SQL)
#    2.  Stop des services backend + frontend
#    3.  Reset git complet (annule TOUTES les modifs locales)
#         + clean (vire fichiers non suivis) en préservant .env
#    4.  git pull origin <branche>
#    5.  Wipe node_modules (backend + frontend)
#    6.  npm install (backend + frontend)
#    7.  DROP SCHEMA public CASCADE → re-create
#    8.  prisma generate + prisma migrate deploy (sur DB vide → 32 migrations
#        appliquées proprement, _prisma_migrations bien renseignée)
#    9.  Seeds : roles, data, policies, BCI users
#   10.  Build frontend (production)
#   11.  Restart des services
#   12.  Vérifications (DB connect, /api/health, comptes seedés)
#
#  Options :
#    --force          Skip toutes les confirmations (CI / automatisation)
#    --branch <nom>   Force une branche spécifique (défaut : branche courante)
#
#  Préserve :
#    - backend/.env
#    - dossier backups/
#    - logs/
# =============================================================================

set -u  # exit on undefined variable. Pas de set -e : on gère les erreurs au cas par cas.

# ─── Couleurs ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
BOLD='\033[1m'; NC='\033[0m'

section() { echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}"; }
info()    { echo -e "  ${BLUE}→${NC} $1"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
err()     { echo -e "  ${RED}✗${NC} $1"; }
die()     { err "$1"; exit 1; }

# ─── Trap interruption (Ctrl+C) ──────────────────────────────────────────────
cleanup_on_interrupt() {
  echo
  warn "Interruption — tentative de redémarrer les services existants…"
  systemctl start optimuscredit-backend 2>/dev/null || true
  systemctl start optimuscredit-frontend 2>/dev/null || true
  exit 130
}
trap cleanup_on_interrupt INT TERM

# ─── Arguments ───────────────────────────────────────────────────────────────
FORCE=false
GIT_BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)   FORCE=true; shift ;;
    --branch)  GIT_BRANCH="$2"; shift 2 ;;
    -h|--help)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//' | head -50
      exit 0 ;;
    *) warn "Argument inconnu ignoré : $1"; shift ;;
  esac
done

# ─── Vérifs préalables ───────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Lance en root : sudo bash $0"
[[ -f /etc/os-release ]] && source /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *"ubuntu"* ]] || die "Requiert Ubuntu."

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
APP_USER="optimuscredit"

[[ -f "$BACKEND_ENV" ]] || die "Fichier $BACKEND_ENV introuvable. Lance d'abord install.sh."

# ─── Lecture .env ────────────────────────────────────────────────────────────
set -o allexport; source "$BACKEND_ENV"; set +o allexport
DB_URL="${DATABASE_URL:-}"
[[ -n "$DB_URL" ]] || die "DATABASE_URL absente du .env"

DB_USER_VAL=$(echo "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS_VAL=$(echo "$DB_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL"     | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL"     | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME_VAL=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

# ─── Bannière ────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║   BCI — RÉINSTALLATION COMPLÈTE (DESTRUCTIVE)             ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Dossier : $APP_DIR"
echo "  DB      : ${DB_USER_VAL}@${DB_HOST}:${DB_PORT}/${DB_NAME_VAL}"
echo "  User    : $APP_USER"
echo ""
echo -e "${RED}  Cette opération va :"
echo "    • Annuler toutes les modifications locales du code"
echo "    • Effacer entièrement la base de données"
echo "    • Réinstaller toutes les dépendances"
echo "    • Rebuilder et redémarrer les services"
echo -e "${NC}"

if [[ "$FORCE" != "true" ]]; then
  read -rp "  Continuer ? Tapez 'REINSTALL' pour confirmer : " confirm
  [[ "$confirm" == "REINSTALL" ]] || die "Annulé."
fi

# =============================================================================
# 1. BACKUP DB
# =============================================================================
section "1. Backup base de données"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
chown "$APP_USER:$APP_USER" "$BACKUP_DIR" 2>/dev/null || true

BACKUP_FILE="$BACKUP_DIR/pre-reinstall_${TS}.dump"
if PGPASSWORD="$DB_PASS_VAL" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER_VAL" -d "$DB_NAME_VAL" \
    --format=custom --file="$BACKUP_FILE" 2>/dev/null; then
  size=$(du -h "$BACKUP_FILE" | cut -f1)
  ok "Backup créé : $BACKUP_FILE ($size)"
else
  warn "Backup impossible (DB peut-être déjà vide). On continue."
fi

# =============================================================================
# 2. STOP DES SERVICES
# =============================================================================
section "2. Arrêt des services"
systemctl stop optimuscredit-backend 2>/dev/null  && ok "Backend arrêté" \
  || warn "Backend déjà arrêté ou absent"
systemctl stop optimuscredit-frontend 2>/dev/null && ok "Frontend arrêté" \
  || warn "Frontend déjà arrêté ou absent"

# =============================================================================
# 3. RESET GIT — annule modifs locales
# =============================================================================
section "3. Reset des modifications locales (git)"
cd "$APP_DIR"

CURRENT_BRANCH=$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "release/v1.0")
TARGET_BRANCH="${GIT_BRANCH:-$CURRENT_BRANCH}"

# Sauvegarde du .env juste au cas où (il est .gitignore mais soyons paranoïaques)
cp "$BACKEND_ENV" "/tmp/.env.bci-safety-$TS" && ok "Sauvegarde temporaire de .env : /tmp/.env.bci-safety-$TS"

# Reset hard sur HEAD + clean (sans -x → préserve .env, node_modules, build/, backups/)
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard HEAD 2>&1 | tail -3
sudo -u "$APP_USER" git -C "$APP_DIR" clean -fd 2>&1 | tail -5
ok "Modifications locales annulées"

# =============================================================================
# 4. GIT PULL
# =============================================================================
section "4. Récupération du code à jour"
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin 2>&1 | tail -3
sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$TARGET_BRANCH" 2>&1 | tail -3 \
  || die "Impossible de basculer sur la branche $TARGET_BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" pull origin "$TARGET_BRANCH" 2>&1 | tail -3 \
  || die "git pull a échoué"

# Restaure le .env si jamais le reset l'a touché (sécurité paranoïaque)
if [[ ! -f "$BACKEND_ENV" ]]; then
  warn ".env disparu — restauration depuis sauvegarde"
  cp "/tmp/.env.bci-safety-$TS" "$BACKEND_ENV"
  chown "$APP_USER:$APP_USER" "$BACKEND_ENV"
  chmod 640 "$BACKEND_ENV"
fi
ok "Code à jour sur $TARGET_BRANCH"

# =============================================================================
# 5. WIPE node_modules + build artifacts
# =============================================================================
section "5. Nettoyage des dépendances et artefacts"
rm -rf "$BACKEND_DIR/node_modules" "$BACKEND_DIR/dist"
rm -rf "$APP_DIR/node_modules"     "$APP_DIR/build"
ok "node_modules et builds supprimés"

# =============================================================================
# 6. NPM INSTALL
# =============================================================================
section "6. Installation des dépendances"
info "Backend…"
cd "$BACKEND_DIR"
sudo -u "$APP_USER" npm install 2>&1 | tail -3
ok "Backend : dépendances installées"

info "Frontend…"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install 2>&1 | tail -3
ok "Frontend : dépendances installées"

# =============================================================================
# 7. DROP & RECREATE SCHEMA
# =============================================================================
section "7. Reset complet de la base PostgreSQL"
info "DROP SCHEMA public CASCADE…"
PGPASSWORD="$DB_PASS_VAL" psql \
  -h "$DB_HOST" -p "$DB_PORT" \
  -U "$DB_USER_VAL" -d "$DB_NAME_VAL" \
  -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null \
  && ok "Schéma 'public' recréé vide" \
  || die "DROP SCHEMA a échoué — vérifie les droits PostgreSQL."

# Re-grant
sudo -u postgres psql -d "$DB_NAME_VAL" -c "ALTER SCHEMA public OWNER TO ${DB_USER_VAL};" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME_VAL" -c "GRANT ALL ON SCHEMA public TO ${DB_USER_VAL};" 2>/dev/null || true
ok "Droits PostgreSQL appliqués"

# =============================================================================
# 8. PRISMA MIGRATE
# =============================================================================
section "8. Application des migrations Prisma"
cd "$BACKEND_DIR"
export DATABASE_URL="$DB_URL"

info "Génération du client Prisma…"
sudo -u "$APP_USER" --preserve-env=DATABASE_URL bash -c "cd '$BACKEND_DIR' && npx prisma generate" 2>&1 | tail -2
ok "Client Prisma généré"

info "Application des migrations sur DB vide…"
if sudo -u "$APP_USER" --preserve-env=DATABASE_URL bash -c "cd '$BACKEND_DIR' && npx prisma migrate deploy" 2>&1 | tail -10; then
  ok "Migrations appliquées"
else
  die "Échec de prisma migrate deploy. Voir la sortie ci-dessus."
fi

# =============================================================================
# 9. SEEDS
# =============================================================================
section "9. Chargement des données initiales"

run_seed() {
  local file="$1"
  local label="$2"
  if [[ -f "$BACKEND_DIR/prisma/$file" ]]; then
    sudo -u "$APP_USER" --preserve-env=DATABASE_URL bash -c "cd '$BACKEND_DIR' && node 'prisma/$file'" 2>&1 | tail -3 \
      && ok "$label" \
      || warn "$file : erreur (non bloquant)"
  else
    warn "$file absent — skip"
  fi
}

run_seed "seed-roles.js"     "Rôles système"
run_seed "seed-data.js"      "Départements et agences"
run_seed "seed-policies.js"  "Politiques de crédit"
run_seed "seed-bci.js"       "Utilisateurs et données BCI"

# =============================================================================
# 10. BUILD FRONTEND
# =============================================================================
section "10. Build de production (frontend)"
cd "$APP_DIR"
sudo -u "$APP_USER" npm run build 2>&1 | tail -5
[[ -d "$APP_DIR/build" ]] && ok "Frontend buildé" || die "Build frontend a échoué"

# =============================================================================
# 11. BUILD BACKEND (TypeScript)
# =============================================================================
section "11. Build backend"
cd "$BACKEND_DIR"
sudo -u "$APP_USER" npm run build 2>&1 | tail -3 \
  && ok "Backend compilé" \
  || warn "Build backend en erreur — voir sortie ci-dessus"

# =============================================================================
# 12. RESTART SERVICES
# =============================================================================
section "12. Redémarrage des services"
systemctl restart optimuscredit-backend  && ok "Backend redémarré" \
  || warn "Échec restart backend — voir : journalctl -u optimuscredit-backend -n 30"
systemctl restart optimuscredit-frontend && ok "Frontend redémarré" \
  || warn "Échec restart frontend — voir : journalctl -u optimuscredit-frontend -n 30"
systemctl reload nginx 2>/dev/null && ok "Nginx rechargé" || true

# =============================================================================
# 13. VÉRIFICATIONS
# =============================================================================
section "13. Vérifications finales"

# DB connect
PGPASSWORD="$DB_PASS_VAL" psql \
  -h "$DB_HOST" -p "$DB_PORT" \
  -U "$DB_USER_VAL" -d "$DB_NAME_VAL" \
  -c "SELECT COUNT(*) FROM users;" 2>&1 | grep -E '^\s+[0-9]+' \
  && ok "DB accessible, table users peuplée" \
  || warn "DB inaccessible ou table users vide"

# Migrations status
status=$(sudo -u "$APP_USER" --preserve-env=DATABASE_URL bash -c "cd '$BACKEND_DIR' && npx prisma migrate status" 2>&1)
echo "$status" | grep -qE "up to date|in sync" \
  && ok "Schéma Prisma synchronisé" \
  || warn "Schéma Prisma : voir 'npx prisma migrate status'"

# Health endpoint
sleep 3
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5007/api/health" | grep -q "200"; then
  ok "Backend répond sur /api/health"
else
  warn "Backend ne répond pas (peut-être encore en démarrage) — vérifie : journalctl -u optimuscredit-backend -n 30"
fi

# =============================================================================
# RÉSUMÉ
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║   RÉINSTALLATION TERMINÉE                                  ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Backup pré-reinstall : $BACKUP_FILE"
echo "  Branche déployée     : $TARGET_BRANCH"
echo ""
echo -e "${BOLD}  Comptes de démonstration :${NC}"
echo "    admin@bci.sn           / Demo2024!     (Administrateur BCI)"
echo "    dg@bci.sn              / Demo2024!     (Direction Générale)"
echo "    comite@bci.sn          / Demo2024!     (Comité de Crédit)"
echo "    analyste@bci.sn        / Demo2024!     (Analyste Risques)"
echo "    ca1@bci.sn             / Demo2024!     (Chargé d'Affaires)"
echo ""
echo -e "${BOLD}  Commandes utiles :${NC}"
echo "    sudo journalctl -u optimuscredit-backend -f"
echo "    sudo systemctl status optimuscredit-backend"
echo ""
