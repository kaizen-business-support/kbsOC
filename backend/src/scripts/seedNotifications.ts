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
    name: 'Nouvelle demande soumise — Dispatchers',
    event: 'APPLICATION_SUBMITTED' as const,
    subject: '[OptimusCredit] Nouvelle demande de crédit — {{applicationNumber}}',
    body: `Une nouvelle demande de financement vient d'être soumise par {{createdByName}} pour le client {{clientName}}.

Montant demandé : {{amount}} {{currency}}

Veuillez affecter ce dossier à un analyste dans les meilleurs délais pour lancer le circuit d'approbation.`,
    recipientRoles: ['RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'ADMIN'],
  },

  {
    name: 'Dossier affecté — Analyste désigné',
    event: 'STEP_ASSIGNED' as const,
    subject: '[OptimusCredit] ⚡ Dossier {{applicationNumber}} affecté — Action requise',
    body: `Le dossier de {{clientName}} ({{applicationNumber}}) vient de vous être affecté et nécessite votre traitement.

Montant : {{amount}} {{currency}}

Veuillez examiner le dossier attentivement et prendre votre décision (approbation, rejet ou demande d'informations complémentaires) en y ajoutant un commentaire motivé. Chaque décision est enregistrée dans le journal d'audit du dossier.`,
    recipientRoles: ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE', 'DIRECTION_JURIDIQUE'],
  },

  {
    name: 'Étape approuvée — Suivi de progression',
    event: 'STEP_APPROVED' as const,
    subject: '[OptimusCredit] ✓ Étape validée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » du dossier de {{clientName}} vient d'être approuvée par {{assigneeName}}.

Le dossier progresse dans le circuit de validation. Vous pouvez suivre l'avancement en temps réel sur la plateforme.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
  },

  {
    name: 'Étape rejetée — Action corrective requise',
    event: 'STEP_REJECTED' as const,
    subject: '[OptimusCredit] ✗ Étape rejetée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » du dossier de {{clientName}} a été rejetée par {{assigneeName}}.

Motif de la décision : {{comments}}

Veuillez examiner les observations du décideur et prendre les mesures nécessaires pour corriger ou compléter le dossier.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
  },

  {
    name: 'Dossier approuvé — Décision finale',
    event: 'APPLICATION_APPROVED' as const,
    subject: '[OptimusCredit] 🎉 Dossier approuvé — {{applicationNumber}}',
    body: `Le dossier de {{clientName}} a obtenu toutes les approbations requises et est officiellement validé.

Montant accordé : {{amount}} {{currency}}

Veuillez procéder aux formalités de mise en place du crédit : préparation du contrat, notification du client et déblocage des fonds selon les procédures en vigueur.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'BACK_OFFICE'],
  },

  {
    name: 'Dossier rejeté — Notification finale',
    event: 'APPLICATION_REJECTED' as const,
    subject: '[OptimusCredit] Dossier non retenu — {{applicationNumber}}',
    body: `Le dossier soumis par {{createdByName}} pour {{clientName}} n'a pas été retenu après examen complet du circuit d'approbation.

Motif de la décision : {{comments}}

Pour toute question, veuillez vous rapprocher de votre responsable hiérarchique ou consulter les détails sur la plateforme.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
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

  // 2. Upsert templates + rules (idempotent: update existing if found by name+event)
  for (const tpl of TEMPLATES) {
    const existing = await prismaClient.notificationTemplate.findFirst({
      where: { event: tpl.event },
      include: { rules: true },
    });

    let template;
    if (existing) {
      template = await prismaClient.notificationTemplate.update({
        where: { id: existing.id },
        data: {
          name: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
          isActive: true,
        },
      });
      console.log(`♻️  Template "${tpl.name}" mis à jour (${tpl.event})`);

      // Update existing rule if present
      if (existing.rules[0]) {
        await prismaClient.notificationRule.update({
          where: { id: existing.rules[0].id },
          data: { recipientRoles: tpl.recipientRoles },
        });
        console.log(`   ↳ Règle mise à jour — destinataires: ${tpl.recipientRoles.join(', ')}`);
      } else {
        await prismaClient.notificationRule.create({
          data: { event: tpl.event, templateId: template.id, recipientRoles: tpl.recipientRoles, isActive: true },
        });
        console.log(`   ↳ Règle créée — destinataires: ${tpl.recipientRoles.join(', ')}`);
      }
      skipped++;
    } else {
      template = await prismaClient.notificationTemplate.create({
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

      await prismaClient.notificationRule.create({
        data: { event: tpl.event, templateId: template.id, recipientRoles: tpl.recipientRoles, isActive: true },
      });
      console.log(`   ↳ Règle créée — destinataires: ${tpl.recipientRoles.join(', ')}`);
      created++;
    }
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
