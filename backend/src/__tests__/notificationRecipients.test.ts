import { resolveNotificationRecipients, RecipientStep, RecipientCandidate } from '../services/notificationRecipients';

/**
 * Contexte — politique BCI, échelle d'escalade.
 *
 * Ligne complète de la politique :
 *   application_created (CREATION, CHARGE_AFFAIRES)
 *   charge_affaires_dispatch (DISPATCH, CHARGE_AFFAIRES)
 *   contre_analyse (ANALYSIS, ANALYSTE_RISQUES)
 *   avis_risques (APPROVAL, RESPONSABLE_RISQUES)          ← palier 1
 *   validation_comite (COMMITTEE, COMITE_CREDIT)          ← palier 2
 *   decision_direction (APPROVAL, DIRECTION_GENERALE)     ← palier 3
 *   back_office_setup (ANALYSIS, BACK_OFFICE)
 *
 * Sur un dossier de faible montant, les paliers 2 et 3 sont élagués par
 * resolveEscalationDecisionStepIds : ils n'ont AUCUN WorkflowStep en base.
 */

const T0 = new Date('2026-01-01T08:00:00Z');
const at = (m: number) => new Date(T0.getTime() + m * 60_000);

/** Ligne d'un petit dossier : comité et direction générale élagués. */
function petitDossierSteps(overrides: Partial<RecipientStep>[] = []): RecipientStep[] {
  const base: RecipientStep[] = [
    { role: 'CHARGE_AFFAIRES', status: 'COMPLETED', stepType: 'CREATION', assigneeId: 'u-ca-1', order: 0, createdAt: at(0) },
    { role: 'CHARGE_AFFAIRES', status: 'APPROVED', stepType: 'DISPATCH', assigneeId: 'u-ca-1', order: 1, createdAt: at(1) },
    { role: 'ANALYSTE_RISQUES', status: 'PENDING', stepType: 'ANALYSIS', assigneeId: 'u-analyste-1', order: 3, createdAt: at(2) },
    { role: 'RESPONSABLE_RISQUES', status: 'PENDING', stepType: 'APPROVAL', assigneeId: null, order: 6, createdAt: at(3) },
    { role: 'BACK_OFFICE', status: 'PENDING', stepType: 'ANALYSIS', assigneeId: null, order: 13, createdAt: at(4) },
  ];
  return base.map((s, i) => ({ ...s, ...(overrides[i] ?? {}) }));
}

/** Tout le personnel actif du tenant — dont des rôles hors ligne d'approbation. */
const CANDIDATES: RecipientCandidate[] = [
  { id: 'u-ca-1', role: 'CHARGE_AFFAIRES' },
  { id: 'u-ca-2', role: 'CHARGE_AFFAIRES' },
  { id: 'u-analyste-1', role: 'ANALYSTE_RISQUES' },
  { id: 'u-analyste-2', role: 'ANALYSTE_RISQUES' },
  { id: 'u-analyste-3', role: 'ANALYSTE_RISQUES' },
  { id: 'u-resp-risques', role: 'RESPONSABLE_RISQUES' },
  { id: 'u-comite-1', role: 'COMITE_CREDIT' },
  { id: 'u-comite-2', role: 'COMITE_CREDIT' },
  { id: 'u-dg', role: 'DIRECTION_GENERALE' },
  { id: 'u-juridique', role: 'DIRECTION_JURIDIQUE' },
  { id: 'u-bo', role: 'BACK_OFFICE' },
  { id: 'u-resp-eng', role: 'RESPONSABLE_ENGAGEMENTS' },
  { id: 'u-admin', role: 'ADMIN' },
  { id: 'u-super', role: 'SUPER_ADMIN' },
];

/** recipientRoles seedés pour STEP_ASSIGNED — les 6 rôles approbateurs. */
const STEP_ASSIGNED_ROLES = [
  'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS',
  'COMITE_CREDIT', 'DIRECTION_GENERALE', 'DIRECTION_JURIDIQUE',
];

describe('resolveNotificationRecipients — ciblage sur la ligne d\'approbation', () => {
  describe('STEP_ASSIGNED (action requise)', () => {
    it('étape ANALYSIS assignée → uniquement l\'assigné et le créateur', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps: petitDossierSteps(),
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'ANALYSTE_RISQUES',
      });

      expect(new Set(recipients)).toEqual(new Set(['u-analyste-1', 'u-ca-1']));
    });

    it('les paliers élagués par l\'escalade ne sont jamais notifiés', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps: petitDossierSteps(),
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'ANALYSTE_RISQUES',
      });

      expect(recipients).not.toContain('u-comite-1');
      expect(recipients).not.toContain('u-comite-2');
      expect(recipients).not.toContain('u-dg');
      expect(recipients).not.toContain('u-juridique');
    });

    it('les collègues de même rôle non assignés ne sont pas notifiés', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps: petitDossierSteps(),
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'ANALYSTE_RISQUES',
      });

      expect(recipients).not.toContain('u-analyste-2');
      expect(recipients).not.toContain('u-analyste-3');
    });

    it('étape APPROVAL (non-ANALYSIS) → tous les porteurs du rôle, comme dans "Mes approbations"', () => {
      // contre_analyse traitée : l'étape ouverte devient avis_risques (RESPONSABLE_RISQUES)
      const steps = petitDossierSteps([{}, {}, { status: 'APPROVED' }]);

      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'RESPONSABLE_RISQUES',
      });

      expect(new Set(recipients)).toEqual(new Set(['u-resp-risques', 'u-ca-1']));
    });

    it('étape ANALYSIS non encore assignée → repli sur les porteurs du rôle (pas de silence)', () => {
      const steps = petitDossierSteps([{}, {}, { assigneeId: null }]);

      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'ANALYSTE_RISQUES',
      });

      expect(new Set(recipients)).toEqual(
        new Set(['u-analyste-1', 'u-analyste-2', 'u-analyste-3', 'u-ca-1'])
      );
    });

    it('dispatching : seul l\'analyste ciblé est notifié, pas ses collègues', () => {
      const steps = petitDossierSteps([{}, {}, { assigneeId: null }]);

      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        targetUserId: 'u-analyste-2',
      });

      expect(new Set(recipients)).toEqual(new Set(['u-analyste-2', 'u-ca-1']));
    });
  });

  describe('encodage des rôles (legacy UPPER_CASE / @map snake_case)', () => {
    it('une étape stockée en snake_case cible bien les utilisateurs du rôle', () => {
      const steps: RecipientStep[] = [
        { role: 'account_manager', status: 'COMPLETED', stepType: 'CREATION', assigneeId: 'u-ca-1', order: 0, createdAt: at(0) },
        { role: 'analyst_supervisor', status: 'PENDING', stepType: 'approval', assigneeId: null, order: 6, createdAt: at(1) },
      ];

      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        nextRole: 'RESPONSABLE_RISQUES',
      });

      expect(new Set(recipients)).toEqual(new Set(['u-resp-risques', 'u-ca-1']));
    });
  });

  describe('événements de dossier — copie aux rôles configurés présents dans la ligne', () => {
    it('APPLICATION_SUBMITTED : les rôles configurés hors ligne sont exclus', () => {
      const recipients = resolveNotificationRecipients({
        event: 'APPLICATION_SUBMITTED',
        steps: petitDossierSteps(),
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        // règle seedée : RESPONSABLE_RISQUES est dans la ligne, ADMIN jamais
        recipientRoles: ['RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'ADMIN'],
      });

      expect(recipients).toContain('u-resp-risques');
      expect(recipients).not.toContain('u-resp-eng'); // étape mise_en_place_sib absente de ce dossier
      expect(recipients).not.toContain('u-admin');
      expect(recipients).not.toContain('u-super');
    });

    it('APPLICATION_APPROVED : créateur, participants et rôles configurés de la ligne', () => {
      const steps = petitDossierSteps([
        {}, {},
        { status: 'APPROVED' },
        { status: 'APPROVED', assigneeId: 'u-resp-risques' },
        { status: 'APPROVED', assigneeId: 'u-bo' },
      ]);

      const recipients = resolveNotificationRecipients({
        event: 'APPLICATION_APPROVED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_ENGAGEMENTS', 'BACK_OFFICE'],
      });

      // participants réels du dossier
      expect(recipients).toContain('u-ca-1');
      expect(recipients).toContain('u-analyste-1');
      expect(recipients).toContain('u-resp-risques');
      expect(recipients).toContain('u-bo');
      // rôle configuré mais absent de la ligne de CE dossier
      expect(recipients).not.toContain('u-resp-eng');
      // jamais de supervision hors ligne
      expect(recipients).not.toContain('u-admin');
      expect(recipients).not.toContain('u-super');
    });
  });

  describe('événements d\'étape — pas de diffusion par rôle', () => {
    it('STEP_APPROVED ne notifie que les personnes ayant touché le dossier et l\'étape en cours', () => {
      const steps = petitDossierSteps([{}, {}, { status: 'APPROVED' }]);

      const recipients = resolveNotificationRecipients({
        event: 'STEP_APPROVED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'BACK_OFFICE'],
      });

      expect(new Set(recipients)).toEqual(
        new Set(['u-ca-1', 'u-analyste-1', 'u-resp-risques'])
      );
      // le rôle BACK_OFFICE est dans la ligne mais n'a encore rien traité :
      // un événement d'étape ne doit pas diffuser à tout le back-office
      expect(recipients).not.toContain('u-bo');
      expect(recipients).not.toContain('u-ca-2');
    });
  });

  describe('robustesse', () => {
    it('dossier sans aucune étape → au minimum le créateur', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps: [],
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
      });

      expect(recipients).toEqual(['u-ca-1']);
    });

    it('aucun doublon même si l\'utilisateur est ciblé, assigné et créateur', () => {
      const steps = petitDossierSteps([{}, {}, { assigneeId: 'u-ca-1' }]);

      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps,
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        targetUserId: 'u-ca-1',
        nextRole: 'ANALYSTE_RISQUES',
      });

      expect(recipients).toEqual(['u-ca-1']);
    });

    it('un utilisateur ciblé absent du tenant n\'est pas inventé', () => {
      const recipients = resolveNotificationRecipients({
        event: 'STEP_ASSIGNED',
        steps: petitDossierSteps(),
        creatorId: 'u-ca-1',
        candidates: CANDIDATES,
        recipientRoles: STEP_ASSIGNED_ROLES,
        targetUserId: 'u-inconnu',
      });

      expect(recipients).not.toContain('u-inconnu');
    });
  });
});
