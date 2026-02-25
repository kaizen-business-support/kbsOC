#!/bin/bash
# =============================================================================
#  OptimusCredit — Installation / Mise à jour via Docker
#  Usage :
#    Première installation : sudo bash install-docker.sh
#    Mise à jour           : sudo bash install-docker.sh --update
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

# ── Détection mode ────────────────────────────────────────────────────────────
MODE="install"
[[ "${1:-}" == "--update" ]] && MODE="update"

# ── Chemins ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/.deploy-config"
ENV_FILE="$PROJECT_ROOT/.env.prod"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
BACKUP_DIR="/var/backups/optimuscredit"

# ── Vérification droits ───────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Ce script doit être exécuté avec sudo : sudo bash $0 ${1:-}"
  exit 1
fi

# =============================================================================
#  FONCTIONS UTILITAIRES
# =============================================================================

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null \
    || openssl rand -hex 64
}

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
    log "Configuration chargée depuis $CONFIG_FILE"
  else
    error "Fichier de config introuvable. Lancez d'abord : sudo bash install-docker.sh"
    exit 1
  fi
}

save_config() {
  cat > "$CONFIG_FILE" <<EOF
# OptimusCredit — Config Docker (généré le $(date))
SERVER_IP="$SERVER_IP"
DB_USER="$DB_USER"
DB_NAME="$DB_NAME"
DB_PASSWORD="$DB_PASSWORD"
REDIS_PASSWORD="$REDIS_PASSWORD"
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
COMPOSE_FILE="$COMPOSE_FILE"
EOF
  chmod 600 "$CONFIG_FILE"
  log "Configuration sauvegardée"
}

backup_database() {
  section "Sauvegarde de la base de données"
  mkdir -p "$BACKUP_DIR"
  local backup_file="$BACKUP_DIR/pre-update_$(date +%Y%m%d_%H%M%S).sql.gz"

  if docker ps --format '{{.Names}}' | grep -q "optimus-postgres"; then
    docker exec optimus-postgres \
      pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$backup_file"
    log "Backup créé : $backup_file ($(du -sh "$backup_file" | cut -f1))"
  else
    warn "Conteneur postgres non actif — backup ignoré"
  fi
}

wait_for_service() {
  local service=$1
  local max_wait=${2:-120}
  local elapsed=0
  info "Attente du service '$service'..."
  while [[ $elapsed -lt $max_wait ]]; do
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "optimus-$service" 2>/dev/null || echo "absent")
    if [[ "$health" == "healthy" ]]; then
      log "$service est prêt"
      return 0
    fi
    sleep 3; elapsed=$((elapsed + 3))
    echo -n "."
  done
  echo
  error "$service n'est pas prêt après ${max_wait}s"
  docker logs "optimus-$service" --tail 20
  exit 1
}

# =============================================================================
#  MODE INSTALLATION
# =============================================================================
install_mode() {
  echo -e "${BOLD}${CYAN}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║      OptimusCredit — Installation Docker                 ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # ── Collecte configuration ───────────────────────────────────────────────────
  section "Configuration"

  read -rp "$(echo -e "${BOLD}IP fixe du serveur Ubuntu sur le réseau local :${NC} ")" SERVER_IP
  [[ -z "$SERVER_IP" ]] && { error "IP requise"; exit 1; }

  DB_USER="optimus"
  DB_NAME="optimus_credit"

  read -rsp "$(echo -e "${BOLD}Mot de passe PostgreSQL (vide = auto-généré) :${NC} ")" DB_PASSWORD
  echo
  [[ -z "$DB_PASSWORD" ]] && DB_PASSWORD="OptimuspgPwd_$(openssl rand -hex 8)"

  read -rsp "$(echo -e "${BOLD}Mot de passe Redis (vide = auto-généré) :${NC} ")" REDIS_PASSWORD
  echo
  [[ -z "$REDIS_PASSWORD" ]] && REDIS_PASSWORD="OptimisRedis_$(openssl rand -hex 8)"

  JWT_SECRET=$(generate_secret)
  JWT_REFRESH_SECRET=$(generate_secret)
  log "Secrets JWT générés"

  save_config
  write_env_file

  # ── Installation Docker ──────────────────────────────────────────────────────
  section "Installation Docker"
  if ! command -v docker &>/dev/null; then
    apt update -qq
    apt install -y -qq ca-certificates curl gnupg
    curl -fsSL https://get.docker.com | sh
    log "Docker installé : $(docker --version)"
  else
    log "Docker déjà présent : $(docker --version)"
  fi

  if ! docker compose version &>/dev/null; then
    apt install -y -qq docker-compose-plugin
    log "Docker Compose installé"
  else
    log "Docker Compose présent : $(docker compose version)"
  fi

  # Ajouter l'utilisateur courant au groupe docker (si lancé via sudo)
  REAL_USER="${SUDO_USER:-$USER}"
  usermod -aG docker "$REAL_USER" 2>/dev/null || true

  # ── Pare-feu ─────────────────────────────────────────────────────────────────
  configure_ufw

  # ── Premier démarrage ────────────────────────────────────────────────────────
  build_and_start

  # ── Données initiales ────────────────────────────────────────────────────────
  seed_database

  final_report
}

# =============================================================================
#  ÉCRITURE DU FICHIER .env.prod
# =============================================================================
write_env_file() {
  cat > "$ENV_FILE" <<EOF
# OptimusCredit — Production Docker (généré le $(date))
# NE PAS committer ce fichier dans git

# ── Base de données ────────────────────────────────────────────────────────────
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public

# ── Backend ────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=5007

# ── JWT ────────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# ── Sécurité ───────────────────────────────────────────────────────────────────
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://${SERVER_IP}
FRONTEND_URL=http://${SERVER_IP}

# ── Stockage ───────────────────────────────────────────────────────────────────
UPLOAD_PATH=/app/uploads
BACKUP_DIR=/var/backups/credit_app
BACKUP_RETENTION_DAYS=30

# ── Logs ───────────────────────────────────────────────────────────────────────
LOG_LEVEL=warn
EOF
  chmod 600 "$ENV_FILE"
  log ".env.prod créé : $ENV_FILE"
}

# =============================================================================
#  BUILD ET DÉMARRAGE DES CONTENEURS
# =============================================================================
build_and_start() {
  section "Build des images Docker"
  cd "$PROJECT_ROOT"

  # Pull des images de base en avance
  docker pull postgres:15-alpine &
  docker pull redis:7-alpine &
  docker pull nginx:1.25-alpine &
  docker pull node:20-alpine &
  wait
  log "Images de base téléchargées"

  # Build sans cache pour une installation propre, avec cache pour les updates
  local build_opts=""
  [[ "$MODE" == "install" ]] && build_opts="--no-cache"

  docker compose -f "$COMPOSE_FILE" build $build_opts \
    2>&1 | grep -E "Step|Successfully|ERROR|error" || true
  log "Images construites"

  section "Démarrage des conteneurs"
  docker compose -f "$COMPOSE_FILE" up -d
  log "Conteneurs démarrés"

  # Vérifier la santé des services critiques
  wait_for_service "postgres" 90
  wait_for_service "redis" 30
  wait_for_service "backend" 120
  log "Tous les services sont healthy"
}

# =============================================================================
#  SEED BASE DE DONNÉES (premier lancement uniquement)
# =============================================================================
seed_database() {
  section "Données initiales"

  local user_count
  user_count=$(docker exec optimus-backend node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count().then(c => { console.log(c); p.\$disconnect(); });
  " 2>/dev/null || echo "0")

  if [[ "$user_count" == "0" ]]; then
    info "Base vide — chargement des données de démo..."
    docker exec optimus-backend npx ts-node src/scripts/seed.ts
    docker exec optimus-backend npx ts-node src/scripts/seed-step-configs.ts
    log "Données initiales chargées (23 utilisateurs, mot de passe : demo123)"
  else
    log "$user_count utilisateurs déjà présents — seed ignoré"
  fi
}

# =============================================================================
#  PARE-FEU UFW
# =============================================================================
configure_ufw() {
  section "Pare-feu UFW"
  apt install -y -qq ufw
  ufw --force reset > /dev/null
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp comment 'OptimusCredit'
  # Les ports internes ne sont pas exposés (docker-compose.prod.yml)
  ufw --force enable
  log "Pare-feu configuré (port 80 ouvert, reste bloqué)"
}

# =============================================================================
#  MODE MISE À JOUR
# =============================================================================
update_mode() {
  echo -e "${BOLD}${YELLOW}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║      OptimusCredit — Mise à jour Docker                  ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  load_config
  cd "$PROJECT_ROOT"

  # ── Vérifier que l'instance tourne ──────────────────────────────────────────
  if ! docker compose -f "$COMPOSE_FILE" ps --status running | grep -q "optimus"; then
    error "Aucun conteneur en cours d'exécution. Lancez d'abord l'installation."
    exit 1
  fi

  backup_database

  # ── Rebuild et redémarrage séquentiel (zéro interruption sur le frontend) ───
  section "Rebuild backend"
  docker compose -f "$COMPOSE_FILE" build backend
  log "Image backend reconstruite"

  section "Redémarrage backend (rolling)"
  # Démarrer le nouveau backend, l'ancien continue à servir les requêtes
  docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
  wait_for_service "backend" 120
  log "Nouveau backend actif"

  section "Rebuild et redémarrage frontend"
  docker compose -f "$COMPOSE_FILE" build frontend
  docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend
  log "Frontend mis à jour"

  # ── Nettoyage des anciennes images ─────────────────────────────────────────
  section "Nettoyage"
  docker image prune -f > /dev/null
  log "Anciennes images supprimées"

  final_report
}

# =============================================================================
#  RAPPORT FINAL
# =============================================================================
final_report() {
  # Statut des conteneurs
  section "Statut des conteneurs"
  docker compose -f "$COMPOSE_FILE" ps

  echo -e "\n${BOLD}${GREEN}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║            ✅  OptimusCredit opérationnel !              ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}URL d'accès réseau local :${NC}  http://${SERVER_IP}"
  echo -e "  ${BOLD}Test API :${NC}                  curl http://${SERVER_IP}/api/health"
  echo -e "  ${BOLD}Compte admin :${NC}              admin@bank.sn / demo123"
  echo
  echo -e "  ${BOLD}Commandes utiles :${NC}"
  echo -e "    Logs backend :   docker logs optimus-backend -f"
  echo -e "    Logs nginx :     docker logs optimus-frontend -f"
  echo -e "    Tous les logs :  docker compose -f $COMPOSE_FILE logs -f"
  echo -e "    Statut :         docker compose -f $COMPOSE_FILE ps"
  echo
  echo -e "  ${BOLD}Pour mettre à jour :${NC}  sudo bash $SCRIPT_DIR/install-docker.sh --update"
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
