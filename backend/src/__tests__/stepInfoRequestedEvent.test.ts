import { NotifEvent } from '@prisma/client';
import { EVENT_EMAIL_CONFIGS } from '../utils/emailTemplates';
import { resolveNotificationRecipients, RecipientStep, RecipientCandidate } from '../services/notificationRecipients';

/**
 * REQUEST_INFO — demande d'informations complémentaires.
 *
 * POST /workflows/:applicationId/approve avec decision=REQUEST_INFO déclenche
 * triggerNotification('STEP_INFO_REQUESTED', …). Tant que cette valeur manquait à
 * l'enum notif_event, Prisma levait une PrismaClientValidationError dès le
 * findMany des règles ; l'erreur était avalée par le try/catch non bloquant de
 * triggerNotification et personne n'était jamais prévenu.
 */
describe('STEP_INFO_REQUESTED', () => {
  it('est une valeur valide de l\'enum NotifEvent', () => {
    // Sans cette valeur, toute requête Prisma filtrant sur cet événement échoue.
    expect(NotifEvent).toHaveProperty('STEP_INFO_REQUESTED');
    expect(NotifEvent.STEP_INFO_REQUESTED).toBe('STEP_INFO_REQUESTED');
  });

  it('dispose de son propre habillage d\'email', () => {
    const cfg = EVENT_EMAIL_CONFIGS['STEP_INFO_REQUESTED'];
    expect(cfg).toBeDefined();
    // buildEventEmail retombe sur APPLICATION_SUBMITTED pour un événement inconnu :
    // un email « Nouvelle demande de crédit reçue » pour une demande d'infos serait trompeur.
    expect(cfg).not.toEqual(EVENT_EMAIL_CONFIGS['APPLICATION_SUBMITTED']);
  });

  describe('destinataires', () => {
    const T0 = new Date('2026-01-01T08:00:00Z');
    const at = (m: number) => new Date(T0.getTime() + m * 60_000);

    const CANDIDATES: RecipientCandidate[] = [
      { id: 'u-ca-1', role: 'CHARGE_AFFAIRES' },
      { id: 'u-ca-2', role: 'CHARGE_AFFAIRES' },
      { id: 'u-analyste-1', role: 'ANALYSTE_RISQUES' },
      { id: 'u-analyste-2', role: 'ANALYSTE_RISQUES' },
      { id: 'u-resp-risques', role: 'RESPONSABLE_RISQUES' },
      { id: 'u-comite-1', role: 'COMITE_CREDIT' },
      { id: 'u-admin', role: 'ADMIN' },
    ];

    // L'étape reste ouverte (IN_REVIEW) et assignée à celui qui a demandé les infos.
    const steps: RecipientStep[] = [
      { role: 'CHARGE_AFFAIRES', status: 'COMPLETED', stepType: 'CREATION', assigneeId: 'u-ca-1', order: 0, createdAt: at(0) },
      { role: 'ANALYSTE_RISQUES', status: 'IN_REVIEW', stepType: 'ANALYSIS', assigneeId: 'u-analyste-1', order: 3, createdAt: at(1) },
      { role: 'RESPONSABLE_RISQUES', status: 'PENDING', stepType: 'APPROVAL', assigneeId: null, order: 6, createdAt: at(2) },
    ];

    it('prévient le créateur du dossier, qui doit fournir les informations', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_INFO_REQUESTED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES'],
      });

      expect(recipients).toContain('u-ca-1');
    });

    it('ne diffuse pas à tout le rôle : l\'étape bloquée reste celle de son assigné', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_INFO_REQUESTED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES'],
      });

      expect(new Set(recipients)).toEqual(new Set(['u-ca-1', 'u-analyste-1']));
      expect(recipients).not.toContain('u-ca-2');
      expect(recipients).not.toContain('u-analyste-2');
      expect(recipients).not.toContain('u-resp-risques');
      expect(recipients).not.toContain('u-comite-1');
      expect(recipients).not.toContain('u-admin');
    });
  });
});
