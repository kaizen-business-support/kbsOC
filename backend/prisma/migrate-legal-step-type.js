/**
 * migrate-legal-step-type.js
 *
 * Script idempotent qui requalifie les étapes "juridiques" existantes
 * (assignedRole = DIRECTION_JURIDIQUE et stepType = DISPATCH) en
 * stepType = LEGAL, pour qu'elles activent l'écran LegalStepPage.
 *
 * Usage : node prisma/migrate-legal-step-type.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔄 Requalification des étapes juridiques en stepType=LEGAL…\n');

  const candidates = await prisma.creditPolicyStep.findMany({
    where: {
      assignedRole: 'DIRECTION_JURIDIQUE',
      stepType: { not: 'LEGAL' },
    },
    include: {
      policy: { select: { name: true, status: true, company: { select: { code: true } } } },
    },
  });

  if (candidates.length === 0) {
    console.log('  ✅ Aucune étape à migrer (tout est déjà en LEGAL).');
    await prisma.$disconnect();
    return;
  }

  for (const s of candidates) {
    await prisma.creditPolicyStep.update({
      where: { id: s.id },
      data: { stepType: 'LEGAL' },
    });
    console.log(`  ✅ ${s.policy.company?.code ?? '?'} | ${s.policy.name} (${s.policy.status})`);
    console.log(`     ${String(s.order).padStart(2)} ${s.stepLabel}  (${s.stepType} → LEGAL)`);
  }

  console.log(`\n📊 ${candidates.length} étape(s) requalifiée(s).`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ Erreur :', e);
  await prisma.$disconnect();
  process.exit(1);
});
