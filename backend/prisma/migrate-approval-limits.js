const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Limites officielles BCI (BCEAO) — à synchroniser avec seed-bci.js
const LIMITS = [
  { role: 'CHARGE_AFFAIRES',         displayName: "Chargé d'Affaires",       minAmount: 0,           maxAmount: 5_000_000,     order: 1, reviewDuration: 1440 },
  { role: 'RESPONSABLE_ENGAGEMENTS', displayName: 'Responsable Engagements', minAmount: 5_000_001,   maxAmount: 50_000_000,    order: 2, reviewDuration: 2880 },
  { role: 'COMITE_CREDIT',           displayName: 'Comité de Crédit',        minAmount: 50_000_001,  maxAmount: 500_000_000,   order: 3, reviewDuration: 4320 },
  { role: 'DIRECTION_GENERALE',      displayName: 'Direction Générale',      minAmount: 500_000_001, maxAmount: 2_000_000_000, order: 4, reviewDuration: 2880 },
];

async function main() {
  console.log('Migration limites d\'approbation...');

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });

  for (const company of companies) {
    console.log(`\n  Compagnie : ${company.name}`);

    for (const limit of LIMITS) {
      const existing = await prisma.approvalLimit.findFirst({
        where: { companyId: company.id, role: limit.role },
      });

      if (existing) {
        await prisma.approvalLimit.update({
          where: { id: existing.id },
          data: {
            displayName:    limit.displayName,
            minAmount:      limit.minAmount,
            maxAmount:      limit.maxAmount,
            order:          limit.order,
            reviewDuration: limit.reviewDuration,
          },
        });
        console.log(`    ✓ Mis à jour : ${limit.role} → [${limit.minAmount.toLocaleString('fr-FR')} – ${limit.maxAmount.toLocaleString('fr-FR')} XOF]`);
      } else {
        await prisma.approvalLimit.create({
          data: { ...limit, companyId: company.id },
        });
        console.log(`    ✓ Créé : ${limit.role} → [${limit.minAmount.toLocaleString('fr-FR')} – ${limit.maxAmount.toLocaleString('fr-FR')} XOF]`);
      }
    }
  }

  console.log('\n✓ Terminé');
}

main()
  .catch(e => { console.error('ERREUR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
