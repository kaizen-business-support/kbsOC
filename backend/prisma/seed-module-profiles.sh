#!/usr/bin/env bash
# Initialise les profils de modules par défaut pour tous les tenants existants.
# Usage: ./prisma/seed-module-profiles.sh
# Pré-requis: NODE_ENV et DATABASE_URL définis (ou fichier .env chargé).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Charger .env si présent
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌  DATABASE_URL non défini. Renseignez-le dans .env ou en variable d'environnement." >&2
  exit 1
fi

echo "🌱  Seeding module profiles pour tous les tenants..."

# Seed via ts-node inline pour éviter de créer un fichier de seed dédié
cd "$ROOT_DIR"
npx ts-node --project tsconfig.json - << 'EOF'
import { PrismaClient } from '@prisma/client';
import { seedDefaultProfiles } from './src/services/moduleProfileService';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  if (companies.length === 0) {
    console.log('⚠️  Aucun tenant trouvé.');
    return;
  }

  for (const company of companies) {
    console.log(`  → ${company.name} (${company.id})`);
    // Utilise un userId système fictif pour le champ createdById
    const sysUser = await prisma.user.findFirst({
      where: { companyMemberships: { some: { companyId: company.id, role: 'SUPER_ADMIN' } } },
      select: { id: true }
    });
    const createdById = sysUser?.id ?? 'system';
    await seedDefaultProfiles(company.id, createdById);
  }

  console.log(`✅  Profils initialisés pour ${companies.length} tenant(s).`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
EOF
