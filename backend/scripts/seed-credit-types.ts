import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCreditTypes() {
  console.log('🌱 Seeding credit types...\n');

  const creditTypes = [
    {
      name: 'Crédit de Trésorerie',
      code: 'CT',
      description: 'Crédit à court terme pour financer le besoin en fonds de roulement',
      defaultRate: 10.5,
      minRate: 9.0,
      maxRate: 13.0,
      minDuration: 3,
      maxDuration: 12,
      requiresCollateral: false,
      isActive: true
    },
    {
      name: 'Crédit d\'Investissement',
      code: 'CI',
      description: 'Crédit à moyen ou long terme pour financer des investissements',
      defaultRate: 11.5,
      minRate: 10.0,
      maxRate: 14.0,
      minDuration: 12,
      maxDuration: 84,
      requiresCollateral: true,
      isActive: true
    },
    {
      name: 'Crédit Immobilier',
      code: 'CIMMO',
      description: 'Crédit pour l\'acquisition de biens immobiliers',
      defaultRate: 12.0,
      minRate: 10.5,
      maxRate: 15.0,
      minDuration: 60,
      maxDuration: 240,
      requiresCollateral: true,
      isActive: true
    },
    {
      name: 'Ligne de Crédit',
      code: 'LC',
      description: 'Facilité de crédit renouvelable',
      defaultRate: 11.0,
      minRate: 9.5,
      maxRate: 13.5,
      minDuration: 12,
      maxDuration: 36,
      requiresCollateral: false,
      isActive: true
    },
    {
      name: 'Crédit Export',
      code: 'CE',
      description: 'Crédit pour le financement des exportations',
      defaultRate: 9.5,
      minRate: 8.0,
      maxRate: 12.0,
      minDuration: 3,
      maxDuration: 24,
      requiresCollateral: true,
      isActive: true
    },
    {
      name: 'Crédit Bail',
      code: 'CB',
      description: 'Financement par crédit-bail (leasing)',
      defaultRate: 13.0,
      minRate: 11.0,
      maxRate: 16.0,
      minDuration: 24,
      maxDuration: 60,
      requiresCollateral: false,
      isActive: true
    }
  ];

  for (const creditType of creditTypes) {
    const existing = await prisma.creditType.findUnique({
      where: { code: creditType.code }
    });

    if (existing) {
      console.log(`✓ Credit type "${creditType.name}" already exists`);
      continue;
    }

    await prisma.creditType.create({
      data: creditType
    });

    console.log(`✓ Created credit type: ${creditType.name}`);
  }

  console.log('\n✅ Credit types seeded successfully!');
}

seedCreditTypes()
  .catch((error) => {
    console.error('❌ Error seeding credit types:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
