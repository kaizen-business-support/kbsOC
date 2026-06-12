// Seed : modèles de notification par défaut (idempotent — upsert)
// Inclut le modèle DASHBOARD_SHARED ajouté en v1.0
// Usage : node backend/prisma/seed-notifications.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATES = [
  {
    name: 'Nouvelle demande soumise — Dispatchers',
    event: 'APPLICATION_SUBMITTED',
    subject: '[OptimusCredit] Nouvelle demande de crédit — {{applicationNumber}}',
    body: `Une nouvelle demande de financement vient d'être soumise par {{createdByName}} pour le client {{clientName}}.

Montant demandé : {{amount}} {{currency}}

Veuillez affecter ce dossier à un analyste dans les meilleurs délais pour lancer le circuit d'approbation.`,
    recipientRoles: ['RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'ADMIN'],
  },
  {
    name: 'Dossier affecté — Analyste désigné',
    event: 'STEP_ASSIGNED',
    subject: '[OptimusCredit] ⚡ Dossier {{applicationNumber}} affecté — Action requise',
    body: `Le dossier de {{clientName}} ({{applicationNumber}}) vient de vous être affecté et nécessite votre traitement.

Montant : {{amount}} {{currency}}

Veuillez examiner le dossier attentivement et prendre votre décision (approbation, rejet ou demande d'informations complémentaires) en y ajoutant un commentaire motivé.`,
    recipientRoles: ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE', 'DIRECTION_JURIDIQUE'],
  },
  {
    name: 'Étape approuvée — Suivi de progression',
    event: 'STEP_APPROVED',
    subject: '[OptimusCredit] ✓ Étape validée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » du dossier de {{clientName}} vient d'être approuvée par {{assigneeName}}.

Le dossier progresse dans le circuit de validation.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
  },
  {
    name: 'Étape rejetée — Action corrective requise',
    event: 'STEP_REJECTED',
    subject: '[OptimusCredit] ✗ Étape rejetée — Dossier {{applicationNumber}}',
    body: `L'étape « {{stepName}} » du dossier de {{clientName}} a été rejetée par {{assigneeName}}.

Motif de la décision : {{comments}}

Veuillez examiner les observations et prendre les mesures nécessaires.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
  },
  {
    name: 'Dossier approuvé — Décision finale',
    event: 'APPLICATION_APPROVED',
    subject: '[OptimusCredit] 🎉 Dossier approuvé — {{applicationNumber}}',
    body: `Le dossier de {{clientName}} a obtenu toutes les approbations requises et est officiellement validé.

Montant accordé : {{amount}} {{currency}}

Veuillez procéder aux formalités de mise en place du crédit.`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'BACK_OFFICE'],
  },
  {
    name: 'Dossier rejeté — Notification finale',
    event: 'APPLICATION_REJECTED',
    subject: '[OptimusCredit] Dossier non retenu — {{applicationNumber}}',
    body: `Le dossier soumis par {{createdByName}} pour {{clientName}} n'a pas été retenu après examen complet du circuit d'approbation.

Motif de la décision : {{comments}}`,
    recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
  },
  {
    name: 'Dashboard partagé — Notification au destinataire',
    event: 'DASHBOARD_SHARED',
    subject: '[OptimusCredit] {{sharerName}} vous a partagé un tableau de bord',
    body: `Bonjour {{recipientName}},

{{sharerName}} vous a partagé le tableau de bord « {{dashboardName}} » sur OptimusCredit.

Niveau d'accès accordé : {{permissionLabel}}.

Vous pouvez y accéder directement depuis la plateforme à tout moment.`,
    recipientRoles: [],
  },
];

async function seedNotifications() {
  let created = 0;
  let updated = 0;

  // 1. Ensure EMAIL channel exists (ne pas écraser la config SMTP existante)
  let emailChannel = await prisma.notificationChannel.findUnique({ where: { type: 'EMAIL' } });
  if (!emailChannel) {
    emailChannel = await prisma.notificationChannel.create({
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
    console.log('  ✓ Canal EMAIL créé');
  } else {
    console.log('  → Canal EMAIL déjà existant — config SMTP préservée');
  }

  // 2. Upsert templates + rules
  for (const tpl of TEMPLATES) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { event: tpl.event },
      include: { rules: true },
    });

    let template;
    if (existing) {
      template = await prisma.notificationTemplate.update({
        where: { id: existing.id },
        data: { name: tpl.name, subject: tpl.subject, body: tpl.body, isActive: true },
      });

      if (existing.rules[0]) {
        await prisma.notificationRule.update({
          where: { id: existing.rules[0].id },
          data: { recipientRoles: tpl.recipientRoles, isActive: true },
        });
      } else {
        await prisma.notificationRule.create({
          data: { event: tpl.event, templateId: template.id, recipientRoles: tpl.recipientRoles, isActive: true },
        });
      }
      console.log(`  → Modèle mis à jour : ${tpl.name}`);
      updated++;
    } else {
      template = await prisma.notificationTemplate.create({
        data: {
          name: tpl.name,
          event: tpl.event,
          channelId: emailChannel.id,
          subject: tpl.subject,
          body: tpl.body,
          isActive: true,
        },
      });
      await prisma.notificationRule.create({
        data: { event: tpl.event, templateId: template.id, recipientRoles: tpl.recipientRoles, isActive: true },
      });
      console.log(`  ✓ Modèle créé       : ${tpl.name}`);
      created++;
    }
  }

  return { created, updated };
}

seedNotifications()
  .then(({ created, updated }) => {
    console.log(`\n  Seed notifications terminé : ${created} créé(s), ${updated} mis à jour`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('  ✗ seed-notifications.js échoué :', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
