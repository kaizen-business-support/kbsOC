# OptimusCredit — Guide de Déploiement Ubuntu On-Premise

**Cible** : Ubuntu 22.04 LTS
**Stack** : Node.js 20 · PostgreSQL 15 · Redis 7 · Nginx · PM2

---

## Table des matières

1. [Prérequis système](#1-prérequis-système)
2. [Installation PostgreSQL](#2-installation-postgresql)
3. [Installation Redis](#3-installation-redis)
4. [Installation Node.js & PM2](#4-installation-nodejs--pm2)
5. [Déploiement du backend](#5-déploiement-du-backend)
6. [Build & déploiement du frontend](#6-build--déploiement-du-frontend)
7. [Configuration Nginx](#7-configuration-nginx)
8. [SSL/TLS avec Certbot](#8-ssltls-avec-certbot)
9. [Pare-feu UFW](#9-pare-feu-ufw)
10. [Fail2ban](#10-fail2ban)
11. [Permissions & répertoires](#11-permissions--répertoires)
12. [Systemd & démarrage automatique](#12-systemd--démarrage-automatique)
13. [Checklist sécurité post-déploiement](#13-checklist-sécurité-post-déploiement)

---

## 1. Prérequis système

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential

# Vérifier les ressources minimales requises
# RAM : 4 Go minimum (8 Go recommandés)
# Disque : 40 Go minimum (100 Go recommandés pour les backups)
# CPU : 2 vCPU minimum
```

---

## 2. Installation PostgreSQL

```bash
# Ajouter le dépôt officiel PostgreSQL
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15

# Activer et démarrer PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Créer l'utilisateur et la base de données
sudo -u postgres psql <<'SQL'
CREATE USER optimus WITH PASSWORD 'VOTRE_MOT_DE_PASSE_FORT';
CREATE DATABASE optimus_credit OWNER optimus;
GRANT ALL PRIVILEGES ON DATABASE optimus_credit TO optimus;
SQL

# Configurer pg_hba.conf pour accepter uniquement les connexions locales
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Remplacer ou ajouter :
# local   all   optimus   md5
# host    all   optimus   127.0.0.1/32   md5
# host    all   optimus   ::1/128        md5

sudo systemctl restart postgresql
```

---

## 3. Installation Redis

```bash
sudo apt install -y redis-server

# Configurer Redis pour écouter uniquement en local
sudo nano /etc/redis/redis.conf
# Modifier/ajouter :
# bind 127.0.0.1
# requirepass VOTRE_MOT_DE_PASSE_REDIS
# maxmemory 256mb
# maxmemory-policy allkeys-lru

sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Tester
redis-cli ping  # doit répondre PONG
```

---

## 4. Installation Node.js & PM2

```bash
# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier les versions
node --version   # v20.x.x
npm --version    # 10.x.x

# Installer PM2 globalement
sudo npm install -g pm2

# Installer pg_dump (client PostgreSQL)
sudo apt install -y postgresql-client-15
```

---

## 5. Déploiement du backend

### 5.1 Créer l'utilisateur applicatif

```bash
sudo useradd -r -s /bin/false optimuscredit
sudo mkdir -p /opt/optimuscredit/backend
sudo chown -R optimuscredit:optimuscredit /opt/optimuscredit
```

### 5.2 Copier les fichiers

```bash
# Depuis votre machine de développement
rsync -avz --exclude=node_modules --exclude=.env \
  backend/ user@server:/opt/optimuscredit/backend/
```

### 5.3 Variables d'environnement (production)

**Ne jamais créer un fichier `.env` en production** — utiliser les variables système :

```bash
sudo nano /etc/environment
# Ajouter :
NODE_ENV=production
PORT=5006
DATABASE_URL="postgresql://optimus:VOTRE_MDP_PG@localhost:5432/optimus_credit"
JWT_SECRET="GÉNÉREZ_UN_SECRET_256_BITS_ICI"
JWT_REFRESH_SECRET="GÉNÉREZ_UN_AUTRE_SECRET_256_BITS"
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12
REDIS_URL="redis://:VOTRE_MDP_REDIS@127.0.0.1:6379"
ALLOWED_ORIGINS="https://votre-domaine.com"
FRONTEND_URL="https://votre-domaine.com"
UPLOAD_PATH=/opt/optimuscredit/uploads
BACKUP_DIR=/var/backups/credit_app
BACKUP_RETENTION_DAYS=30
BACKUP_NOTIFY_EMAIL=admin@votre-domaine.com
SMTP_HOST=smtp.votre-serveur.com
SMTP_PORT=587
SMTP_USER=noreply@votre-domaine.com
SMTP_PASS=VOTRE_MDP_SMTP
DB_USER=optimus
DB_PASSWORD=VOTRE_MDP_PG
DB_HOST=localhost
DB_PORT=5432
DB_NAME=optimus_credit
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=warn
```

```bash
# Générer des secrets sécurisés
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5.4 Installation des dépendances et migration

```bash
cd /opt/optimuscredit/backend
sudo -u optimuscredit npm ci --production
sudo -u optimuscredit npx prisma migrate deploy
sudo -u optimuscredit npm run build
```

### 5.5 Fichier ecosystem PM2

Créer `/opt/optimuscredit/ecosystem.config.js` :

```js
module.exports = {
  apps: [{
    name: 'optimuscredit-backend',
    script: '/opt/optimuscredit/backend/dist/server.js',
    instances: 2,           // cluster mode (adapter au nombre de CPU)
    exec_mode: 'cluster',
    user: 'optimuscredit',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '1G',
    error_file: '/var/log/optimuscredit/error.log',
    out_file: '/var/log/optimuscredit/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
```

```bash
sudo mkdir -p /var/log/optimuscredit
sudo chown optimuscredit:optimuscredit /var/log/optimuscredit

pm2 start /opt/optimuscredit/ecosystem.config.js
pm2 save
```

---

## 6. Build & déploiement du frontend

```bash
# Sur la machine de développement
cd frontend   # ou à la racine du projet React
REACT_APP_API_URL=https://votre-domaine.com/api npm run build

# Copier le build vers le serveur
rsync -avz build/ user@server:/opt/optimuscredit/frontend/
```

---

## 7. Configuration Nginx

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/optimuscredit
```

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com www.votre-domaine.com;

    # SSL (Certbot les ajoutera automatiquement)
    ssl_certificate     /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data:; connect-src 'self';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10m;

    # Frontend (React SPA)
    root /opt/optimuscredit/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Static assets long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        client_max_body_size 10m;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/optimuscredit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
```

---

## 8. SSL/TLS avec Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com \
  --email admin@votre-domaine.com --agree-tos --no-eff-email

# Renouvellement automatique (cron)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Tester le renouvellement
sudo certbot renew --dry-run
```

---

## 9. Pare-feu UFW

```bash
sudo apt install -y ufw

# Politique par défaut
sudo ufw default deny incoming
sudo ufw default allow outgoing

# N'autoriser que les ports nécessaires
sudo ufw allow 22/tcp    comment 'SSH'
sudo ufw allow 80/tcp    comment 'HTTP → redirect HTTPS'
sudo ufw allow 443/tcp   comment 'HTTPS'

# Activer
sudo ufw enable
sudo ufw status verbose

# IMPORTANT : bloquer l'accès direct au port 5006 depuis l'extérieur
# (Nginx fait le reverse proxy — le port 5006 ne doit pas être public)
sudo ufw deny 5006/tcp
sudo ufw deny 5432/tcp   # PostgreSQL
sudo ufw deny 6379/tcp   # Redis
```

---

## 10. Fail2ban

```bash
sudo apt install -y fail2ban

sudo nano /etc/fail2ban/jail.d/optimuscredit.conf
```

```ini
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log

[nginx-req-limit]
enabled  = true
filter   = nginx-req-limit
action   = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath  = /var/log/nginx/error.log
findtime = 600
bantime  = 7200
maxretry = 10
```

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

---

## 11. Permissions & répertoires

```bash
# Répertoire de backups — propriétaire : optimuscredit
sudo mkdir -p /var/backups/credit_app
sudo chown optimuscredit:optimuscredit /var/backups/credit_app
sudo chmod 750 /var/backups/credit_app

# Répertoire uploads
sudo mkdir -p /opt/optimuscredit/uploads/applications
sudo chown -R optimuscredit:optimuscredit /opt/optimuscredit/uploads
sudo chmod -R 750 /opt/optimuscredit/uploads

# Logs
sudo mkdir -p /var/log/optimuscredit
sudo chown optimuscredit:optimuscredit /var/log/optimuscredit
sudo chmod 750 /var/log/optimuscredit

# Binaires PostgreSQL (pour pg_dump/psql depuis le service)
sudo setfacl -m u:optimuscredit:rx /usr/bin/pg_dump
sudo setfacl -m u:optimuscredit:rx /usr/bin/psql
```

---

## 12. Systemd & démarrage automatique

```bash
# Sauvegarder la liste PM2
pm2 save

# Générer le script systemd pour PM2
pm2 startup systemd -u optimuscredit --hp /home/optimuscredit
# Copier et exécuter la commande affichée

sudo systemctl enable pm2-optimuscredit
sudo systemctl start pm2-optimuscredit
sudo systemctl status pm2-optimuscredit
```

---

## 13. Checklist sécurité post-déploiement

### Réseau

- [ ] `GET /api/clients` sans token retourne **401** (non 200)
- [ ] Port 5006 inaccessible depuis l'extérieur (`curl http://IP_PUBLIQUE:5006` → connexion refusée)
- [ ] Port 5432 (PostgreSQL) inaccessible depuis l'extérieur
- [ ] Port 6379 (Redis) inaccessible depuis l'extérieur
- [ ] HTTPS fonctionne et HTTP redirige vers HTTPS
- [ ] Headers HSTS, X-Frame-Options, CSP présents (`curl -I https://votre-domaine.com`)

### Authentification

- [ ] Login avec mot de passe incorrect retourne **401**
- [ ] Login réussi + logout + réutilisation du token retourne **401**
- [ ] `GET /api/auth/me` avec token expiré retourne **401**
- [ ] Après 10 tentatives de login en 15 min → **429** (rate limiter)
- [ ] 2FA setup fonctionne (QR code → scan → code → backup codes)
- [ ] Login avec 2FA activé : step 1 (mot de passe) → step 2 (code TOTP)
- [ ] Code TOTP invalide → refusé

### Fichiers & uploads

- [ ] Upload d'un fichier `.jpg` contenant du code PHP → **400** (magic bytes invalides)
- [ ] Tentative de path traversal (`../../../etc/passwd` dans l'applicationId) → **400**
- [ ] Upload > 10 MB → **413**

### Backups

- [ ] Backup manuel déclenché via API → fichier `.sql.gz` créé dans `/var/backups/credit_app/`
- [ ] Email de notification reçu après backup
- [ ] Cron backup partiel toutes les 6h et full tous les jours à 2h (`crontab -l -u optimuscredit`)

### Performance

- [ ] `GET /api/departments` après premier appel : réponse < 10 ms (cache Redis)
- [ ] `GET /api/roles` : une seule requête GROUP BY au lieu de N+1

### Logs

- [ ] Logs applicatifs dans `/var/log/optimuscredit/`
- [ ] Logs Nginx dans `/var/log/nginx/`
- [ ] Logs PostgreSQL accessibles via `journalctl -u postgresql`

---

## Commandes utiles

```bash
# Status de l'application
pm2 status
pm2 logs optimuscredit-backend --lines 50

# Redémarrer après déploiement
pm2 reload optimuscredit-backend

# Status des services
sudo systemctl status nginx postgresql redis-server fail2ban

# Consulter les tentatives bloquées par Fail2ban
sudo fail2ban-client status nginx-req-limit

# Backup manuel immédiat
curl -X POST https://votre-domaine.com/api/backup/create \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'

# Monitoring Redis
redis-cli -a VOTRE_MDP_REDIS info stats
redis-cli -a VOTRE_MDP_REDIS dbsize

# Taille des backups
du -sh /var/backups/credit_app/
ls -lh /var/backups/credit_app/
```

---

*Dernière mise à jour : Février 2026*
