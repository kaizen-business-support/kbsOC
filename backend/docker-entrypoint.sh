#!/bin/sh
set -e

echo "▶ Vérification de la connexion à la base de données..."
until npx prisma db ping > /dev/null 2>&1; do
  echo "  PostgreSQL non prêt — nouvelle tentative dans 3s..."
  sleep 3
done
echo "  ✅ Connexion PostgreSQL OK"

echo "▶ Application des migrations Prisma..."
npx prisma migrate deploy
echo "  ✅ Migrations appliquées"

echo "▶ Démarrage du serveur OptimusCredit (port $PORT)..."
exec node dist/server.js
