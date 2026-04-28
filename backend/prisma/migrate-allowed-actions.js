const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Actions autorisées par stepType — règle métier BCI
const ACTIONS_BY_STEPTYPE = {
  CREATION:  ['approve'],
  DISPATCH:  ['approve', 'transfer'],
  ANALYSIS:  ['approve', 'request_info'],
  APPROVAL:  ['approve', 'reject', 'request_info'],
  COMMITTEE: ['approve', 'reject', 'request_info'],
  LEGAL:     ['approve', 'transfer'],
};

async function main() {
  console.log('Migration allowedActions par stepType...');

  const policies = await prisma.creditPolicy.findMany({
    where: { isActive: true },
    include: { steps: true, company: { select: { code: true } } },
  });

  let updated = 0;
  for (const policy of policies) {
    console.log(`\n  Politique ${policy.code} (${policy.company.code})`);
    for (const step of policy.steps) {
      const actions = ACTIONS_BY_STEPTYPE[step.stepType] || ['approve', 'reject', 'request_info'];
      const same = JSON.stringify((step.allowedActions || []).slice().sort()) === JSON.stringify(actions.slice().sort());
      if (!same) {
        await prisma.creditPolicyStep.update({
          where: { id: step.id },
          data: { allowedActions: actions },
        });
        console.log(`    ✓ ${step.stepName.padEnd(32)} [${step.stepType}] → [${actions.join(', ')}]`);
        updated++;
      }
    }
  }

  console.log(`\n✓ ${updated} étape(s) mise(s) à jour`);
}

main()
  .catch(e => { console.error('ERREUR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
