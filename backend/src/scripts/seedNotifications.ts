/**
 * Seed default notification templates and rules.
 * Run:  npx ts-node -r tsconfig-paths/register src/scripts/seedNotifications.ts
 * Or call the API:  POST /api/notification-channels/seed-defaults
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Plain-text template definitions ──────────────────────────────────────────
// Bodies are plain text with {{variable}} placeholders.
// The HTML wrapper (colors, info card, CTA) is applied automatically at send time.

const TEMPLATES = [
  {
    name: 'Nouvelle demande — Analyste crédit',
    event: 'APPLICATION_SUBMITTED' as const,
    subject: '[OptimusCredit] Nouvelle demande de crédit — {{applicationNumber}}',
    body: `Une nouvelle demande de financement vient d'être soumise par {{createdByName}}.

Veuillez procéder à l'analyse financière et technique du dossier dans les meilleurs délais et faire avancer le circuit d'approbation.`,
    recipientRoles: ['CREDIT_ANALYST', 'BRANCH_MANAGER'],
  },

  {
    name: 'Action requise — Approbation en attente',
    event: 'STEP_ASSIGNED' as const,
    subject: '[OptimusCredit] ⚡ Action requise — Dossier {{applicationNumber}} en attente de votre décision',
    body: `Ce dossier a été transmis à votre niveau hiérarchique et nécessite votre décision.

Veuillez l'examiner attentivement et approuver ou rejeter en ajoutant un commentaire motivé. Toute décision sera enregistrée dans l'audit du dossier.`,
    recipientRoles: ['BRANCH_MANAGER', 'CREDIT_COMMITTEE', 'MANAGEMENT'],
  },

  {
    name: 'Étape approuvée — Progression du dossier',
    event: 'STEP_APPROVED' as const,
    subject: '[OptimusCredit] ✓ Étape approuvée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » vient d'être approuvée par {{assigneeName}}.

Le dossier continue son parcours dans le circuit de validation. Vous pouvez suivre l'avancement en temps réel sur la plateforme.`,
    recipientRoles: ['ACCOUNT_MANAGER', 'CREDIT_ANALYST'],
  },

  {
    name: 'Étape rejetée — Action corrective requise',
    event: 'STEP_REJECTED' as const,
    subject: '[OptimusCredit] ✗ Étape rejetée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » a été rejetée par {{assigneeName}}.

Motif de rejet : {{comments}}

Veuillez examiner les commentaires du décideur et prendre les mesures nécessaires pour corriger ou compléter le dossier avant toute nouvelle soumission.`,
    recipientRoles: ['ACCOUNT_MANAGER', 'CREDIT_ANALYST'],
  },

  {
    name: 'Dossier approuvé — Décision finale',
    event: 'APPLICATION_APPROVED' as const,
    subject: '[OptimusCredit] 🎉 Dossier approuvé — {{applicationNumber}}',
    body: `Le dossier de {{clientName}} a obtenu toutes les approbations requises et est officiellement validé.

Veuillez procéder aux formalités de mise en place du crédit : préparation du contrat, notification du client et déblocage des fonds selon les procédures en vigueur.`,
    recipientRoles: ['ACCOUNT_MANAGER', 'CREDIT_ANALYST', 'BRANCH_MANAGER'],
  },

  {
    name: 'Dossier rejeté — Notification finale',
    event: 'APPLICATION_REJECTED' as const,
    subject: '[OptimusCredit] Dossier non retenu — {{applicationNumber}}',
    body: `Le dossier soumis par {{createdByName}} pour {{clientName}} n'a pas été retenu après examen complet du comité de crédit.

Motif de la décision : {{comments}}

Pour toute question concernant cette décision, veuillez vous rapprocher de votre responsable hiérarchique ou consulter les commentaires détaillés sur la plateforme.`,
    recipientRoles: ['ACCOUNT_MANAGER', 'CREDIT_ANALYST'],
  },
];

// ─── Seed function ─────────────────────────────────────────────────────────────

export async function seedDefaultNotifications(prismaClient: PrismaClient = prisma): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // 1. Ensure EMAIL channel exists (admin configures SMTP separately in the UI)
  let emailChannel = await prismaClient.notificationChannel.findUnique({ where: { type: 'EMAIL' } });
  if (!emailChannel) {
    emailChannel = await prismaClient.notificationChannel.create({
      data: {
        type: 'EMAIL',
        name: 'Email (SMTP)',
        isActive: false,
        config: {
          host: '',
          port: 587,
          user: '',
          pass: '',
          fromName: 'OptimusCredit',
          fromEmail: '',
          secure: false,
        },
      },
    });
    console.log('✅ Canal EMAIL créé');
  }

  // 2. Create templates + rules
  for (const tpl of TEMPLATES) {
    // Idempotent: skip if same name+event already exists
    const existing = await prismaClient.notificationTemplate.findFirst({
      where: { name: tpl.name, event: tpl.event },
    });

    if (existing) {
      console.log(`⏭  Template "${tpl.name}" — déjà existant, ignoré`);
      skipped++;
      continue;
    }

    const template = await prismaClient.notificationTemplate.create({
      data: {
        name: tpl.name,
        event: tpl.event,
        channelId: emailChannel.id,
        subject: tpl.subject,
        body: tpl.body,
        isActive: true,
      },
    });
    console.log(`✅ Template "${tpl.name}" créé (${tpl.event})`);

    try {
      await prismaClient.notificationRule.create({
        data: {
          event: tpl.event,
          templateId: template.id,
          recipientRoles: tpl.recipientRoles,
          isActive: true,
        },
      });
      console.log(`   ↳ Règle créée — destinataires: ${tpl.recipientRoles.join(', ')}`);
    } catch {
      console.log(`   ↳ Règle déjà existante — ignorée`);
    }

    created++;
  }

  return { created, skipped };
}

// ─── Run standalone ────────────────────────────────────────────────────────────

if (require.main === module) {
  seedDefaultNotifications()
    .then(({ created, skipped }) => {
      console.log(`\n🎉 Seed terminé : ${created} template(s) créé(s), ${skipped} ignoré(s)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed échoué :', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
