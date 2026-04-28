const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Conditions de montant par étape — règles BCI (BCEAO)
// null = aucune condition (étape toujours présente)
// conditionMinAmount = montant minimum pour que l'étape soit incluse dans le circuit
const STEP_CONDITIONS = {
  application_created:       { conditionMinAmount: null,        conditionMaxAmount: null },
  charge_affaires_dispatch:  { conditionMinAmount: null,        conditionMaxAmount: null },
  verification_completude:   { conditionMinAmount: null,        conditionMaxAmount: null },
  contre_analyse:            { conditionMinAmount: null,        conditionMaxAmount: null },
  calcul_ratios_prudentiels: { conditionMinAmount: null,        conditionMaxAmount: null },
  notation_interne:          { conditionMinAmount: null,        conditionMaxAmount: null },
  avis_risques:              { conditionMinAmount: null,        conditionMaxAmount: null },
  // Comité de crédit : uniquement pour les dossiers > 50 000 000 XOF
  validation_comite:         { conditionMinAmount: 50_000_001,  conditionMaxAmount: null },
  // Direction Générale : uniquement pour les dossiers > 500 000 000 XOF
  decision_direction:        { conditionMinAmount: 500_000_001, conditionMaxAmount: null },
  mise_en_place_sib:         { conditionMinAmount: null,        conditionMaxAmount: null },
  formalisation_garanties:   { conditionMinAmount: null,        conditionMaxAmount: null },
  saisie_garanties:          { conditionMinAmount: null,        conditionMaxAmount: null },
  tirage_fonds:              { conditionMinAmount: null,        conditionMaxAmount: null },
  back_office_setup:         { conditionMinAmount: null,        conditionMaxAmount: null },
};

async function main() {
  console.log('Migration conditions de montant sur les étapes de politique...\n');

  const policies = await prisma.creditPolicy.findMany({
    where: { isActive: true },
    include: { steps: true, company: { select: { code: true } } },
  });

  let updated = 0;
  for (const policy of policies) {
    console.log(`  Politique ${policy.code} (${policy.company.code})`);
    for (const step of policy.steps) {
      const cond = STEP_CONDITIONS[step.stepName];
      if (!cond) {
        console.log(`    ⚠  ${step.stepName} : pas de règle définie, ignoré`);
        continue;
      }
      const changed =
        String(step.conditionMinAmount ?? null) !== String(cond.conditionMinAmount) ||
        String(step.conditionMaxAmount ?? null) !== String(cond.conditionMaxAmount);

      if (changed) {
        await prisma.creditPolicyStep.update({
          where: { id: step.id },
          data: {
            conditionMinAmount: cond.conditionMinAmount,
            conditionMaxAmount: cond.conditionMaxAmount,
          },
        });
        const minStr = cond.conditionMinAmount ? `> ${Number(cond.conditionMinAmount - 1).toLocaleString('fr-FR')} XOF` : 'toujours';
        console.log(`    ✓ ${step.stepName.padEnd(32)} condition: ${minStr}`);
        updated++;
      }
    }
  }

  console.log(`\n✓ ${updated} étape(s) mise(s) à jour`);

  // Vérification finale
  console.log('\n=== Vérification circuit par montant ===');
  const testAmounts = [2_000_000, 10_000_000, 60_000_000, 600_000_000];
  const allPolicies = await prisma.creditPolicy.findMany({
    where: { isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  for (const policy of allPolicies) {
    for (const amount of testAmounts) {
      const steps = policy.steps.filter(s => {
        if (s.conditionMinAmount !== null && amount < Number(s.conditionMinAmount)) return false;
        if (s.conditionMaxAmount !== null && amount > Number(s.conditionMaxAmount)) return false;
        return true;
      });
      console.log(`  ${amount.toLocaleString('fr-FR').padStart(15)} XOF → ${steps.length} étapes: [${steps.map(s => s.assignedRole.replace('RESPONSABLE_','R_').replace('DIRECTION_','DIR_')).join(' → ')}]`);
    }
  }
}

main()
  .catch(e => { console.error('ERREUR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
