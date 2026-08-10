/**
 * auditCircuitIntegrity.ts
 *
 * Diagnostic et réparation des circuits d'approbation incohérents.
 *
 * ── Pourquoi un script distinct ──────────────────────────────────────────────
 * Les deux endpoints de réparation existants traitent d'autres symptômes :
 *   - POST /api/workflows/fix-missing-approval-steps  → dossiers UNDER_REVIEW
 *     dont TOUTES les étapes sont complétées : il en recrée une suivante.
 *   - POST /api/workflows/fix-prematurely-approved    → dossiers APPROVED à qui
 *     il manque des étapes du plan : il les rouvre.
 * Ni l'un ni l'autre ne regarde l'ORDRE des étapes. Le défaut traité ici est
 * différent : une étape d'ordre N est complétée alors qu'une étape d'ordre < N
 * ne l'est pas — l'incohérence que le dispatching fabriquait et que le garde
 * séquentiel de l'approbation bloque ensuite définitivement. Étendre l'un de ces
 * deux endpoints reviendrait à leur faire porter une seconde responsabilité sans
 * rapport, et à exécuter une réparation depuis une requête HTTP alors qu'elle
 * demande une inspection préalable.
 *
 * ── Ce que le script fait ────────────────────────────────────────────────────
 *  1. Incohérences d'ordre : signalées, jamais réparées automatiquement. Annuler
 *     une étape déjà traitée détruirait une décision d'un intervenant ; le choix
 *     revient à l'utilisateur métier. Le circuit se débloque de toute façon en
 *     traitant l'étape amont restée ouverte (point 2).
 *  2. Étapes ouvertes affectées à un compte hors périmètre ou inactif : ce sont
 *     elles qui figent réellement le dossier, une étape ANALYSIS n'étant visible
 *     que de son assigné. Le script propose un remplaçant et, sur confirmation,
 *     applique la ré-affectation.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   npx ts-node src/scripts/auditCircuitIntegrity.ts                  # dry-run
 *   npx ts-node src/scripts/auditCircuitIntegrity.ts --apply --confirm
 *   npx ts-node src/scripts/auditCircuitIntegrity.ts --application APP-2026-000019
 *
 * Sans --apply ET --confirm, AUCUNE écriture n'est faite. Le script est
 * idempotent : un second passage ne trouve plus rien à réparer.
 */
import { PrismaClient } from '@prisma/client';
import {
  toGuardStep,
  checkBranchScope,
  findOrderInconsistencies,
  GuardStep,
  OrderInconsistency,
} from '../services/workflowGuards';
import { canonicalRole } from '../utils/roleAliases';

const prisma = new PrismaClient();

// ─── Arguments ────────────────────────────────────────────────────────────────

interface Options {
  apply: boolean;
  confirm: boolean;
  applicationNumber: string | null;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { apply: false, confirm: false, applicationNumber: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') opts.apply = true;
    else if (argv[i] === '--confirm') opts.confirm = true;
    else if (argv[i] === '--application') opts.applicationNumber = argv[++i] ?? null;
  }
  return opts;
}

/** L'écriture n'est autorisée que si les deux drapeaux sont présents. */
export function isWriteEnabled(opts: Options): boolean {
  return opts.apply && opts.confirm;
}

// ─── Détections ───────────────────────────────────────────────────────────────

// ─── Programme principal ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const writeEnabled = isWriteEnabled(opts);

  console.log('');
  console.log('═══ Audit d\'intégrité des circuits d\'approbation ═══');
  console.log(writeEnabled
    ? '  MODE ÉCRITURE — les ré-affectations seront appliquées.'
    : '  MODE SIMULATION (dry-run) — aucune écriture. Ajoutez --apply --confirm pour appliquer.');
  if (opts.applicationNumber) console.log(`  Filtre : ${opts.applicationNumber}`);
  console.log('');

  const applications = await prisma.creditApplication.findMany({
    where: {
      ...(opts.applicationNumber ? { applicationNumber: opts.applicationNumber } : {}),
      status: { notIn: ['REJECTED', 'CANCELLED'] },
    },
    include: {
      creator: { select: { branch: true, department: true } },
      workflowSteps: {
        include: { policyStep: { select: { order: true, stepLabel: true, stepType: true } } },
      },
    },
    orderBy: { applicationNumber: 'asc' },
  });

  const inconsistencies: OrderInconsistency[] = [];
  const orphanSteps: Array<{
    applicationId: string;
    applicationNumber: string;
    companyId: string | null;
    step: GuardStep;
    assigneeLabel: string;
    problem: string;
    creatorBranch: string | null;
  }> = [];

  for (const app of applications) {
    const steps = app.workflowSteps.map(toGuardStep);
    inconsistencies.push(...findOrderInconsistencies(app.applicationNumber, steps));

    const creatorBranch = app.creator?.branch || app.creator?.department || null;

    for (const raw of app.workflowSteps) {
      if (raw.completedAt !== null || !raw.assigneeId) continue;

      const assignee = await prisma.user.findUnique({
        where: { id: raw.assigneeId },
        select: { name: true, email: true, role: true, branch: true, department: true, isActive: true },
      });
      if (!assignee) continue;

      let problem: string | null = null;
      if (!assignee.isActive) {
        problem = 'compte désactivé';
      } else {
        const scope = checkBranchScope(
          { role: assignee.role as string, branch: assignee.branch, department: assignee.department },
          creatorBranch,
          { requireAttachment: true },
        );
        if (!scope.allowed) problem = scope.reason ?? 'hors périmètre';
      }

      if (problem) {
        orphanSteps.push({
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          companyId: app.companyId,
          step: toGuardStep(raw),
          assigneeLabel: `${assignee.name} <${assignee.email}>`,
          problem,
          creatorBranch,
        });
      }
    }
  }

  // ── 1. Incohérences d'ordre ────────────────────────────────────────────────
  console.log(`── Incohérences d'ordre : ${inconsistencies.length}`);
  for (const inc of inconsistencies) {
    console.log(
      `   ${inc.applicationNumber} : "${inc.completedStep}" (ordre ${inc.completedOrder}) est complétée ` +
      `alors que "${inc.blockingStep}" (ordre ${inc.blockingOrder}) ne l'est pas.`
    );
  }
  if (inconsistencies.length > 0) {
    console.log('   → Non réparées automatiquement : annuler une étape déjà traitée effacerait');
    console.log('     la décision de son intervenant. Traitez l\'étape amont restée ouverte,');
    console.log('     le circuit se débloque alors de lui-même.');
  }
  console.log('');

  // ── 2. Étapes ouvertes affectées hors périmètre ────────────────────────────
  console.log(`── Étapes bloquées par leur assigné : ${orphanSteps.length}`);
  let repaired = 0;

  for (const item of orphanSteps) {
    const label = item.step.policyStep?.stepLabel ?? item.step.stepName;
    console.log(`   ${item.applicationNumber} : "${label}" affectée à ${item.assigneeLabel} — ${item.problem}`);

    const replacement = await findReplacement(item.step, item.companyId, item.creatorBranch);
    if (!replacement) {
      console.log('     → Aucun remplaçant éligible. Rattachez un profil du bon rôle à cette agence.');
      continue;
    }

    console.log(`     → Remplaçant proposé : ${replacement.name} <${replacement.email}> (${replacement.activeCount} dossier(s) actif(s))`);

    if (!writeEnabled) continue;

    // Ré-affectation : même effet que le chemin isReassign de POST /dispatching/assign
    // (assigneeId + statut PENDING + commentaire), sans dupliquer sa logique de garde,
    // déjà satisfaite ici puisque le remplaçant est choisi dans le périmètre.
    await prisma.workflowStep.update({
      where: { id: item.step.id },
      data: {
        assigneeId: replacement.id,
        status: 'PENDING',
        comments: `Ré-affecté à ${replacement.name} par l'audit d'intégrité (précédent assigné : ${item.assigneeLabel} — ${item.problem})`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: replacement.id,
        applicationId: item.applicationId,
        action: 'WORKFLOW_STEP_REASSIGNED_BY_AUDIT',
        entityType: 'workflow_step',
        entityId: item.step.id,
        oldValues: { assigneeId: item.step.assigneeId, assignee: item.assigneeLabel, problem: item.problem },
        newValues: { assigneeId: replacement.id, assignee: `${replacement.name} <${replacement.email}>` },
      },
    });

    repaired++;
    console.log('     ✓ Ré-affectation appliquée et journalisée.');
  }

  console.log('');
  console.log('═══ Résumé ═══');
  console.log(`  Dossiers examinés          : ${applications.length}`);
  console.log(`  Incohérences d'ordre       : ${inconsistencies.length} (signalées)`);
  console.log(`  Étapes bloquées            : ${orphanSteps.length}`);
  console.log(`  Ré-affectations appliquées : ${repaired}${writeEnabled ? '' : ' (simulation)'}`);
  console.log('');
}

/**
 * Remplaçant éligible pour une étape : même rôle, tenant identique, actif, dans le
 * périmètre du dossier — le moins chargé d'abord, comme la suggestion de dispatching.
 */
async function findReplacement(
  step: GuardStep,
  companyId: string | null,
  creatorBranch: string | null,
): Promise<{ id: string; name: string; email: string; activeCount: number } | null> {
  if (!companyId) return null;

  const candidates = await prisma.user.findMany({
    where: {
      role: canonicalRole(step.role) as any,
      isActive: true,
      memberships: { some: { companyId, isActive: true } },
    },
    include: { assignedSteps: { where: { status: { in: ['PENDING', 'IN_REVIEW'] } } } },
  });

  const eligible = candidates
    .filter(c => c.id !== step.assigneeId)
    .filter(c =>
      checkBranchScope(
        { role: c.role as string, branch: (c as any).branch, department: c.department },
        creatorBranch,
        { requireAttachment: true },
      ).allowed
    )
    .sort((a, b) => a.assignedSteps.length - b.assignedSteps.length);

  const best = eligible[0];
  return best ? { id: best.id, name: best.name, email: best.email, activeCount: best.assignedSteps.length } : null;
}

if (require.main === module) {
  main()
    .catch(err => {
      console.error('Audit interrompu :', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
