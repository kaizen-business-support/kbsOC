const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Politique de crédit BCI standard — 14 étapes
// Idempotent : ne crée pas si le code existe déjà pour la compagnie
const POLICY_CODE = 'POL-BCI-GENERALE';

const STEPS = [
  {
    stepName: 'application_created',
    stepLabel: 'Création du dossier',
    order: 0,
    stepType: 'DISPATCH',
    assignedRole: 'CHARGE_AFFAIRES',
    expectedDurationHours: 24,
    maxDurationHours: 72,
    phase: 'Montage dossier',
  },
  {
    stepName: 'charge_affaires_dispatch',
    stepLabel: 'Traitement par le CA',
    order: 1,
    stepType: 'DISPATCH',
    assignedRole: 'CHARGE_AFFAIRES',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Montage dossier',
  },
  {
    stepName: 'verification_completude',
    stepLabel: 'Vérification de la complétude',
    order: 2,
    stepType: 'ANALYSIS',
    assignedRole: 'CHARGE_AFFAIRES',
    expectedDurationHours: 24,
    maxDurationHours: 48,
    phase: 'Montage dossier',
  },
  {
    stepName: 'contre_analyse',
    stepLabel: 'Contre-analyse',
    order: 3,
    stepType: 'ANALYSIS',
    assignedRole: 'ANALYSTE_RISQUES',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Analyse risques',
  },
  {
    stepName: 'calcul_ratios_prudentiels',
    stepLabel: 'Calcul des ratios prudentiels',
    order: 4,
    stepType: 'ANALYSIS',
    assignedRole: 'ANALYSTE_RISQUES',
    expectedDurationHours: 24,
    maxDurationHours: 72,
    phase: 'Analyse risques',
  },
  {
    stepName: 'notation_interne',
    stepLabel: 'Notation interne',
    order: 5,
    stepType: 'ANALYSIS',
    assignedRole: 'ANALYSTE_RISQUES',
    expectedDurationHours: 24,
    maxDurationHours: 72,
    phase: 'Analyse risques',
  },
  {
    stepName: 'avis_risques',
    stepLabel: 'Avis risques',
    order: 6,
    stepType: 'APPROVAL',
    assignedRole: 'RESPONSABLE_RISQUES',
    expectedDurationHours: 24,
    maxDurationHours: 72,
    phase: 'Analyse risques',
  },
  {
    stepName: 'validation_comite',
    stepLabel: 'Validation comité de crédit',
    order: 7,
    stepType: 'COMMITTEE',
    assignedRole: 'COMITE_CREDIT',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Approbation',
  },
  {
    stepName: 'decision_direction',
    stepLabel: 'Décision direction générale',
    order: 8,
    stepType: 'APPROVAL',
    assignedRole: 'DIRECTION_GENERALE',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Approbation',
  },
  {
    stepName: 'mise_en_place_sib',
    stepLabel: 'Mise en place SIB',
    order: 9,
    stepType: 'DISPATCH',
    assignedRole: 'RESPONSABLE_ENGAGEMENTS',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Mise en place',
  },
  {
    stepName: 'formalisation_garanties',
    stepLabel: 'Formalisation des garanties',
    order: 10,
    stepType: 'DISPATCH',
    assignedRole: 'DIRECTION_JURIDIQUE',
    expectedDurationHours: 48,
    maxDurationHours: 120,
    phase: 'Mise en place',
  },
  {
    stepName: 'saisie_garanties',
    stepLabel: 'Saisie des garanties',
    order: 11,
    stepType: 'DISPATCH',
    assignedRole: 'DIRECTION_JURIDIQUE',
    expectedDurationHours: 24,
    maxDurationHours: 72,
    phase: 'Mise en place',
  },
  {
    stepName: 'tirage_fonds',
    stepLabel: 'Tirage des fonds',
    order: 12,
    stepType: 'DISPATCH',
    assignedRole: 'BACK_OFFICE',
    expectedDurationHours: 24,
    maxDurationHours: 48,
    phase: 'Mise en place',
  },
  {
    stepName: 'back_office_setup',
    stepLabel: 'Mise en place back-office',
    order: 13,
    stepType: 'DISPATCH',
    assignedRole: 'BACK_OFFICE',
    expectedDurationHours: 24,
    maxDurationHours: 48,
    phase: 'Mise en place',
  },
];

async function main() {
  console.log('Seed politiques de crédit...');

  // Récupérer toutes les compagnies actives
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('  ⚠ Aucune compagnie active — seed ignoré.');
    return;
  }

  for (const company of companies) {
    // Vérifier si la politique existe déjà pour cette compagnie
    const existing = await prisma.creditPolicy.findFirst({
      where: { companyId: company.id, code: POLICY_CODE },
    });

    if (existing) {
      console.log(`  ✓ ${company.name} : politique "${POLICY_CODE}" déjà présente (id: ${existing.id})`);
      continue;
    }

    // Créer la politique avec ses étapes
    const policy = await prisma.creditPolicy.create({
      data: {
        name: 'Politique Générale de Crédit',
        code: POLICY_CODE,
        description: 'Circuit standard de traitement des demandes de crédit',
        status: 'DRAFT',
        isActive: true,
        version: 1,
        companyId: company.id,
        steps: {
          create: STEPS.map(step => ({
            stepName: step.stepName,
            stepLabel: step.stepLabel,
            order: step.order,
            stepType: step.stepType,
            assignedRole: step.assignedRole,
            expectedDurationHours: step.expectedDurationHours,
            maxDurationHours: step.maxDurationHours,
            phase: step.phase,
            isRequired: true,
            isActive: true,
            creditTypeIds: [],
          })),
        },
      },
    });

    console.log(`  ✓ ${company.name} : politique créée (${STEPS.length} étapes, id: ${policy.id})`);
  }

  console.log('✓ Terminé');
}

main().catch(console.error).finally(() => prisma.$disconnect());
