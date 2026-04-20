/**
 * seed-demo-applications.js
 * Crée des demandes de crédit de démo réparties sur les 6 derniers mois
 * pour permettre de tester les filtres date du tableau de bord analytique.
 *
 * Usage : node prisma/seed-demo-applications.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Retourne une date X jours dans le passé, à l'heure spécifiée */
function daysAgo(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Retourne une date dans l'intervalle [minDays, maxDays] avant aujourd'hui */
function randDate(minDays, maxDays) {
  const days = minDays + Math.floor(Math.random() * (maxDays - minDays));
  const hour = 8 + Math.floor(Math.random() * 9); // 08h–17h
  const min  = Math.floor(Math.random() * 60);
  return daysAgo(days, hour, min);
}

/** Monte une série d'étapes complétées en cascade à partir de startDate */
function buildSteps(stepDefs, startDate, durationPerStepHours = 24) {
  const steps = [];
  let current = new Date(startDate);
  for (const def of stepDefs) {
    const completedAt = new Date(current.getTime() + durationPerStepHours * 3_600_000);
    steps.push({
      stepName: def.stepName,
      role: def.role,
      status: 'COMPLETED',
      createdAt: new Date(current),
      completedAt,
    });
    current = completedAt;
  }
  return steps;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Chargement des données existantes…');

  // Récupérer les CAs existants avec leur département
  const cas = await prisma.user.findMany({
    where: { role: 'CHARGE_AFFAIRES' },
    select: { id: true, name: true, department: true },
  });
  if (cas.length === 0) throw new Error('Aucun utilisateur CHARGE_AFFAIRES trouvé — lancez seed-bci.js d\'abord');

  // Récupérer les clients existants
  const clients = await prisma.client.findMany({ select: { id: true, companyId: true } });
  if (clients.length === 0) throw new Error('Aucun client trouvé — lancez seed-bci.js d\'abord');

  const companyId = clients[0].companyId;
  console.log(`  ${cas.length} chargés d'affaires · ${clients.length} clients · companyId=${companyId}`);

  // Données de démo : [montant, objet, durée, statut, daysAgoRange[min,max]]
  const demoApplications = [
    // ── Mois en cours ──────────────────────────────────────────────────────
    { amount: 8_500_000,  purpose: 'Financement équipement industriel',         duration: 36, status: 'UNDER_REVIEW', daysRange: [1,  10]  },
    { amount: 3_200_000,  purpose: 'Fonds de roulement saisonnier',             duration: 12, status: 'UNDER_REVIEW', daysRange: [2,  8]   },
    { amount: 15_000_000, purpose: 'Extension d\'entrepôt',                     duration: 60, status: 'SUBMITTED',    daysRange: [0,  5]   },

    // ── Mois -1 ────────────────────────────────────────────────────────────
    { amount: 5_000_000,  purpose: 'Achat véhicules utilitaires',               duration: 24, status: 'APPROVED',     daysRange: [32, 45]  },
    { amount: 12_000_000, purpose: 'Acquisition terrain commercial',             duration: 48, status: 'APPROVED',     daysRange: [25, 35]  },
    { amount: 2_800_000,  purpose: 'Crédit trésorerie court terme',             duration: 6,  status: 'REJECTED',     daysRange: [28, 40]  },
    { amount: 7_500_000,  purpose: 'Rénovation locaux professionnels',          duration: 36, status: 'APPROVED',     daysRange: [20, 30]  },

    // ── Mois -2 ────────────────────────────────────────────────────────────
    { amount: 20_000_000, purpose: 'Construction d\'usine agroalimentaire',     duration: 84, status: 'APPROVED',     daysRange: [55, 70]  },
    { amount: 4_000_000,  purpose: 'Matériel informatique et logiciels',        duration: 18, status: 'REJECTED',     daysRange: [50, 65]  },
    { amount: 9_000_000,  purpose: 'Développement réseau de distribution',      duration: 48, status: 'APPROVED',     daysRange: [45, 60]  },
    { amount: 1_500_000,  purpose: 'Fonds de démarrage activité commerciale',   duration: 12, status: 'REJECTED',     daysRange: [48, 62]  },

    // ── Mois -3 ────────────────────────────────────────────────────────────
    { amount: 35_000_000, purpose: 'Investissement immobilier commercial',      duration: 120,status: 'APPROVED',     daysRange: [85, 100] },
    { amount: 6_500_000,  purpose: 'Achat matières premières en gros',         duration: 12, status: 'APPROVED',     daysRange: [78, 92]  },
    { amount: 18_000_000, purpose: 'Financement projet solaire industriel',     duration: 72, status: 'APPROVED',     daysRange: [80, 95]  },
    { amount: 3_000_000,  purpose: 'Crédit revolving entreprise',              duration: 24, status: 'REJECTED',     daysRange: [75, 90]  },

    // ── Mois -4 ────────────────────────────────────────────────────────────
    { amount: 11_000_000, purpose: 'Modernisation atelier de production',       duration: 60, status: 'APPROVED',     daysRange: [115, 130]},
    { amount: 4_500_000,  purpose: 'Acquisition équipements frigorifiques',     duration: 30, status: 'APPROVED',     daysRange: [108, 125]},
    { amount: 25_000_000, purpose: 'Financement programme export céréales',     duration: 24, status: 'APPROVED',     daysRange: [112, 128]},
    { amount: 2_000_000,  purpose: 'Micro-crédit commerce ambulant',            duration: 6,  status: 'REJECTED',     daysRange: [110, 130]},

    // ── Mois -5 ────────────────────────────────────────────────────────────
    { amount: 8_000_000,  purpose: 'Financement campagne agricole',             duration: 12, status: 'APPROVED',     daysRange: [145, 160]},
    { amount: 14_000_000, purpose: 'Construction entrepôt frigorifique',        duration: 60, status: 'APPROVED',     daysRange: [138, 155]},
    { amount: 3_500_000,  purpose: 'Fonds de roulement BTP',                   duration: 18, status: 'APPROVED',     daysRange: [142, 158]},
    { amount: 6_000_000,  purpose: 'Acquisition outillage chantier',           duration: 24, status: 'REJECTED',     daysRange: [140, 160]},
  ];

  // Séquences d'étapes avec leur rôle assigné
  const approvedSteps = [
    { stepName: 'charge_affaires_dispatch',  role: 'CHARGE_AFFAIRES'         },
    { stepName: 'verification_completude',   role: 'CHARGE_AFFAIRES'         },
    { stepName: 'contre_analyse',            role: 'ANALYSTE_RISQUES'        },
    { stepName: 'calcul_ratios_prudentiels', role: 'ANALYSTE_RISQUES'        },
    { stepName: 'notation_interne',          role: 'ANALYSTE_RISQUES'        },
    { stepName: 'avis_risques',              role: 'RESPONSABLE_RISQUES'     },
    { stepName: 'validation_comite',         role: 'COMITE_CREDIT'           },
    { stepName: 'decision_direction',        role: 'DIRECTION_GENERALE'      },
  ];
  const rejectedSteps = [
    { stepName: 'charge_affaires_dispatch',  role: 'CHARGE_AFFAIRES'         },
    { stepName: 'verification_completude',   role: 'CHARGE_AFFAIRES'         },
    { stepName: 'contre_analyse',            role: 'ANALYSTE_RISQUES'        },
    { stepName: 'avis_risques',              role: 'RESPONSABLE_RISQUES'     },
  ];

  let appCounter = 1000; // évite les conflits avec APP-2026-000001
  let created = 0;

  for (const spec of demoApplications) {
    const ca     = cas[created % cas.length];
    const client = clients[created % clients.length];
    const appNum = `APP-DEMO-${String(appCounter++).padStart(6, '0')}`;
    const createdAt = randDate(spec.daysRange[0], spec.daysRange[1]);

    // Déterminer les étapes à créer
    const stepNames = spec.status === 'APPROVED' ? approvedSteps : rejectedSteps;
    const steps = buildSteps(stepNames, createdAt, 6); // 6h par étape

    const submittedAt = new Date(createdAt.getTime() + 30 * 60_000); // +30 min

    try {
      await prisma.creditApplication.create({
        data: {
          applicationNumber: appNum,
          clientId: client.id,
          createdBy: ca.id,
          companyId: companyId || client.companyId,
          amount: spec.amount,
          currency: 'XOF',
          purpose: spec.purpose,
          durationMonths: spec.duration,
          status: spec.status,
          submittedAt: spec.status !== 'DRAFT' ? submittedAt : null,
          createdAt,
          workflowSteps: {
            create: steps.map(s => ({
              stepName: s.stepName,
              role: s.role,
              status: s.status,
              assigneeId: ca.id,
              createdAt: s.createdAt,
              completedAt: s.completedAt,
            })),
          },
        },
      });
      created++;
      console.log(`  ✓ ${appNum} | ${spec.status.padEnd(12)} | ${(spec.amount / 1_000_000).toFixed(1)}M XOF | ${createdAt.toISOString().split('T')[0]} | ${ca.name}`);
    } catch (err) {
      console.error(`  ✗ ${appNum} — ${err.message}`);
    }
  }

  console.log(`\n✓ ${created} / ${demoApplications.length} demandes de démo créées`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
