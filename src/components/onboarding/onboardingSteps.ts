import type { StepOptions } from 'shepherd.js';

export interface OnboardingPermissions {
  canViewAnalytics: boolean;
  canViewReports: boolean;
  canViewCodir: boolean;
  canViewApplications: boolean;
  canFinancialAnalysis: boolean;
  canViewConfiguration: boolean;
}

export interface BuildStepsArgs {
  permissions: OnboardingPermissions;
  isMobile: boolean;
  roleLabel: string;
  onComplete: () => void;
}

const baseButtons = (label: string) => [
  { text: 'Précédent', action: function (this: any) { this.back(); }, classes: 'shepherd-btn-secondary' },
  { text: label,       action: function (this: any) { this.next(); }, classes: 'shepherd-btn-primary' },
];

export function buildSteps({ permissions, isMobile, roleLabel, onComplete }: BuildStepsArgs): StepOptions[] {
  const p = permissions;
  const steps: StepOptions[] = [];

  // Étape 1 — Welcome (always, centered).
  steps.push({
    id: 'welcome',
    title: 'Bienvenue sur OptimusCredit',
    text: `Découvrez en quelques étapes les fonctionnalités adaptées à votre profil${roleLabel ? ` <strong>${roleLabel}</strong>` : ''}.`,
    buttons: [
      { text: 'Commencer', action: function (this: any) { this.next(); }, classes: 'shepherd-btn-primary' },
    ],
    cancelIcon: { enabled: true },
  });

  // Mobile: replace steps 2-5 with a single hamburger-targeted step.
  if (isMobile) {
    if (p.canViewAnalytics || p.canViewReports || p.canViewCodir || p.canViewApplications || p.canFinancialAnalysis || p.canViewConfiguration) {
      steps.push({
        id: 'mobile-menu',
        title: 'Vos modules',
        text: 'Tous les modules de la plateforme sont accessibles depuis ce menu, adaptés à votre rôle.',
        attachTo: { element: '[data-tour="mobile-menu-trigger"]', on: 'bottom' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
  } else {
    if (p.canViewAnalytics || p.canViewReports || p.canViewCodir) {
      steps.push({
        id: 'sidebar-dashboard',
        title: 'Pilotage & Rapports',
        text: 'Retrouvez ici vos tableaux de bord (Home, CODIR, Analytics) et le centre de rapports de crédit.',
        attachTo: { element: '[data-tour="sidebar-dashboard"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canViewApplications) {
      steps.push({
        id: 'sidebar-credit',
        title: 'Processus Crédit',
        text: 'Créez, suivez et approuvez les demandes de crédit, et consultez les workflows en cours.',
        attachTo: { element: '[data-tour="sidebar-credit"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canFinancialAnalysis) {
      steps.push({
        id: 'sidebar-analysis',
        title: 'Analyse financière',
        text: 'Effectuez des analyses hors processus : saisie manuelle, analyse, et rapports financiers.',
        attachTo: { element: '[data-tour="sidebar-analysis"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canViewConfiguration) {
      steps.push({
        id: 'sidebar-config',
        title: 'Configuration',
        text: 'Paramétrez les types de crédit, politiques, utilisateurs et options de la plateforme.',
        attachTo: { element: '[data-tour="sidebar-config"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
  }

  // Header profile (always).
  steps.push({
    id: 'header-profile',
    title: 'Profil & paramètres',
    text: 'Accédez à votre profil, vos paramètres de compte, la 2FA, et vos notifications depuis ce menu.',
    attachTo: { element: '[data-tour="header-profile"]', on: 'bottom-end' },
    buttons: baseButtons('Suivant'),
    cancelIcon: { enabled: true },
  });

  // Final step (always, centered, calls onComplete).
  steps.push({
    id: 'done',
    title: "C'est parti",
    text: 'Vous êtes prêt à utiliser OptimusCredit. Vous pourrez refaire ce tour à tout moment depuis votre menu profil.',
    buttons: [
      { text: 'Précédent', action: function (this: any) { this.back(); }, classes: 'shepherd-btn-secondary' },
      { text: 'Terminer', action: function (this: any) { onComplete(); this.complete(); }, classes: 'shepherd-btn-primary' },
    ],
    cancelIcon: { enabled: true },
  });

  return steps;
}
