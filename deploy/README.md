# OptimusCredit — Scripts de déploiement

Deux scripts d'installation pour Ubuntu, selon que vous utilisez Docker ou non.

---

## ⚠️ Prérequis sur le serveur Ubuntu

```bash
# Convertir les fins de ligne (si copié depuis Windows)
sudo apt install -y dos2unix
dos2unix deploy/install-native.sh
dos2unix deploy/install-docker.sh

# Rendre exécutables
chmod +x deploy/install-native.sh deploy/install-docker.sh
```

---

## 🖥️  Script 1 — Installation native (sans Docker)

**Installe :** Node.js 20 · PostgreSQL 15 · Redis · Nginx · PM2

### Première installation
```bash
sudo bash deploy/install-native.sh
```
Le script demande interactivement :
- L'IP fixe du serveur sur le réseau local
- Les mots de passe (ou les génère automatiquement)

### Mise à jour
```bash
sudo bash deploy/install-native.sh --update
```
Ce que fait la mise à jour :
1. Sauvegarde automatique de la base de données
2. Copie des nouveaux fichiers (backend + frontend)
3. `npm ci` + `prisma migrate deploy` + recompilation
4. `pm2 reload` (rechargement **sans coupure de service**)
5. Rechargement Nginx

---

## 🐳  Script 2 — Installation Docker

**Installe :** Docker · Docker Compose · 4 conteneurs (postgres, redis, backend, frontend/nginx)

### Première installation
```bash
sudo bash deploy/install-docker.sh
```

### Mise à jour
```bash
sudo bash deploy/install-docker.sh --update
```
Ce que fait la mise à jour :
1. Sauvegarde automatique de la base de données
2. Rebuild de l'image backend uniquement
3. Redémarrage du conteneur backend (le frontend continue de servir)
4. Rebuild et redémarrage du frontend
5. Nettoyage des anciennes images

---

## 📁 Fichiers générés lors de l'installation

| Fichier | Description |
|---|---|
| `deploy/.deploy-config` | Config sauvegardée (IP, mots de passe, secrets) — **ne pas supprimer** |
| `.env.prod` | Variables d'environnement Docker production |
| `/opt/optimuscredit/backend/.env` | Variables d'environnement natif |

---

## 🔄 Stratégie de mise à jour sans interruption

### Natif (PM2)
```
Ancienne version → continue de servir
       ↓
pm2 reload optimuscredit  ← redémarre instance par instance
       ↓
Nouvelle version active
```

### Docker
```
Ancienne image backend → continue de servir pendant le rebuild
       ↓
docker compose up -d --no-deps backend  ← remplace le conteneur
       ↓
Nouvelle image active, frontend reconstruit ensuite
```

---

## 🛟 En cas de problème après mise à jour

### Rollback natif
```bash
# Restaurer le dernier backup
sudo -u postgres psql optimus_credit < /var/backups/optimuscredit/pre-update_YYYYMMDD_HHMMSS.sql.gz

# Revenir à l'ancienne version (si vous utilisez git)
git checkout HEAD~1
sudo bash deploy/install-native.sh --update
```

### Rollback Docker
```bash
# Restaurer la base
gunzip -c /var/backups/optimuscredit/pre-update_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i optimus-postgres psql -U optimus optimus_credit

# Revenir à l'ancienne image (si taguée)
docker compose -f docker-compose.prod.yml down
docker tag optimuscredit-backend:previous optimuscredit-backend:latest
docker compose -f docker-compose.prod.yml up -d
```
